import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractedFieldCount, extractRupFromText } from "@/lib/rup-extractor";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona un archivo PDF." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "El PDF no puede superar 15 MB." }, { status: 400 });

  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const result = await parser.getText();
    if (result.text.trim().length < 80) {
      return NextResponse.json({
        error: "El PDF parece ser una imagen escaneada. No contiene texto suficiente para extraer los datos automáticamente.",
      }, { status: 422 });
    }
    const values = extractRupFromText(result.text);
    return NextResponse.json({ values, found: extractedFieldCount(values), pages: result.total });
  } catch {
    return NextResponse.json({ error: "No fue posible leer el PDF. Verifica que no tenga contraseña ni esté dañado." }, { status: 422 });
  } finally {
    await parser.destroy();
  }
}
