import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { extractedFieldCount, extractRupExperiencesFromText, extractRupFromText } from "@/lib/rup-extractor";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function preparePdfRuntime() {
  const canvas = await import("@napi-rs/canvas");
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix as typeof DOMMatrix;
  if (!globalThis.ImageData) globalThis.ImageData = canvas.ImageData as unknown as typeof ImageData;
  if (!globalThis.Path2D) globalThis.Path2D = canvas.Path2D as unknown as typeof Path2D;
}

async function extractWithPdfParse(data: Uint8Array) {
  await preparePdfRuntime();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    return await parser.getText();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractTextByPage(data: Uint8Array) {
  await preparePdfRuntime();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "));
      page.cleanup();
    }
    return { text: pages.join("\n"), total: document.numPages };
  } finally {
    await document.destroy();
  }
}

function pdfErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const companyId = String(formData.get("company_id") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona un archivo PDF." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "El PDF no puede superar 15 MB." }, { status: 400 });
  }
  if (!companyId) return NextResponse.json({ error: "Selecciona la empresa." }, { status: 400 });
  const { data: membership } = await supabase.from("profiles").select("id")
    .eq("id", user.id).eq("company_id", companyId).eq("is_active", true).maybeSingle();
  if (!membership) return NextResponse.json({ error: "No tienes acceso a esa empresa." }, { status: 403 });

  const data = new Uint8Array(await file.arrayBuffer());
  let result: { text: string; total: number };

  try {
    result = await extractWithPdfParse(data);
  } catch (primaryError) {
    console.warn("[rup:extract] El lector principal falló; usando lectura por páginas.", {
      fileName: file.name,
      fileSize: file.size,
      error: pdfErrorDetails(primaryError),
    });

    try {
      result = await extractTextByPage(data.slice());
    } catch (fallbackError) {
      console.error("[rup:extract] Los dos lectores PDF fallaron.", {
        fileName: file.name,
        fileSize: file.size,
        primaryError: pdfErrorDetails(primaryError),
        fallbackError: pdfErrorDetails(fallbackError),
      });
      return NextResponse.json({
        error: "El PDF abre correctamente, pero su estructura interna no es compatible con la lectura automática. Puedes cargar otra copia exportada como PDF o ingresar los datos manualmente.",
        code: "PDF_STRUCTURE_NOT_SUPPORTED",
      }, { status: 422 });
    }
  }

  try {
    if (result.text.trim().length < 80) {
      return NextResponse.json({
        error: "El PDF contiene principalmente imágenes y no tiene texto seleccionable suficiente. La extracción por OCR todavía no está disponible.",
        code: "PDF_REQUIRES_OCR",
      }, { status: 422 });
    }
    const values = extractRupFromText(result.text);
    const experiences = extractRupExperiencesFromText(result.text);
    const admin = getSupabaseAdminClient();
    const storagePath = `${companyId}/RUP/rup-vigente.pdf`;
    const { error: uploadError } = await admin.storage.from("tender-documents").upload(
      storagePath,
      data,
      { contentType: "application/pdf", upsert: true },
    );
    if (uploadError) throw new Error(`No fue posible archivar el RUP: ${uploadError.message}`);
    const { error: metadataError } = await admin.from("reusable_tender_documents").upsert({
      company_id: companyId,
      category: "RUP",
      name: file.name,
      storage_path: storagePath,
      mime_type: "application/pdf",
      file_size: file.size,
      issue_date: values.issue_date || null,
      valid_until: values.valid_until || null,
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "storage_path" });
    if (metadataError) throw new Error(`No fue posible registrar el RUP: ${metadataError.message}`);
    return NextResponse.json({
      values,
      experiences,
      found: extractedFieldCount(values),
      experienceCount: experiences.length,
      archived: true,
      pages: result.total,
    });
  } catch (error) {
    console.error("[rup:extract] Falló el análisis del texto extraído.", {
      fileName: file.name,
      fileSize: file.size,
      error: pdfErrorDetails(error),
    });
    return NextResponse.json({
      error: "El PDF fue leído, pero no fue posible interpretar sus datos. Intenta con otra copia del RUP.",
      code: "RUP_TEXT_NOT_RECOGNIZED",
    }, { status: 422 });
  }
}
