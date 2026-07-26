"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { extractCompanyDocument, extractPdfText } from "@/lib/company-document-extractor";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function uploadReusableDocument(data: FormData) {
  const companyId = String(data.get("company_id") ?? "");
  const category = String(data.get("category") ?? "OTRO").trim().toUpperCase();
  const issueDate = String(data.get("issue_date") ?? "") || null;
  const validUntil = String(data.get("valid_until") ?? "") || null;
  const file = data.get("file");
  if (!companyId || !(file instanceof File) || !file.size) throw new Error("Selecciona una empresa y un archivo.");
  if (file.size > MAX_FILE_SIZE) throw new Error("El archivo no puede superar 15 MB.");
  if (!allowedTypes.has(file.type)) throw new Error("Solo se permiten archivos PDF, PNG o JPG.");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");
  const { data: membership } = await supabase.from("profiles").select("id")
    .eq("id", user.id).eq("company_id", companyId).eq("is_active", true).maybeSingle();
  if (!membership) throw new Error("No tienes acceso a esa empresa.");

  const safeName = file.name.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  const storagePath = `${companyId}/${category}/${Date.now()}-${safeName}`;
  const admin = getSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from("tender-documents")
    .upload(storagePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  if (uploadError) throw new Error(`No fue posible guardar el archivo: ${uploadError.message}`);

  const { error: metadataError } = await admin.from("reusable_tender_documents").insert({
    company_id: companyId,
    category,
    name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    file_size: file.size,
    issue_date: issueDate,
    valid_until: validUntil,
    uploaded_by: user.id,
  });
  if (metadataError) {
    await admin.storage.from("tender-documents").remove([storagePath]);
    throw new Error(`No fue posible registrar el documento: ${metadataError.message}`);
  }
  if (file.type === "application/pdf" && ["RUT", "CAMARA_COMERCIO"].includes(category)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = extractCompanyDocument(await extractPdfText(bytes), category);
    if (Object.keys(extracted.fields).length) {
      const { error: companyError } = await admin.from("companies").update(extracted.fields).eq("id", companyId);
      if (companyError) throw new Error(`El documento se guardó, pero no fue posible completar la empresa: ${companyError.message}`);
    }
    for (const [index, item] of extracted.ciiu.entries()) {
      await admin.from("company_ciiu_codes").upsert({
        company_id: companyId,
        code: item.code,
        description: item.description || null,
        is_primary: index === 0,
      }, { onConflict: "company_id,code" });
    }
  }
  revalidatePath("/tenders/documents");
  revalidatePath("/commercial/setup");
}

export async function deleteReusableDocument(data: FormData) {
  const documentId = String(data.get("document_id") ?? "").trim();
  const companyId = String(data.get("company_id") ?? "").trim();
  if (!documentId || !companyId) throw new Error("No fue posible identificar el documento.");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Debes iniciar sesión.");
  const { data: membership } = await supabase.from("profiles").select("id")
    .eq("id", user.id).eq("company_id", companyId).eq("is_active", true).maybeSingle();
  if (!membership) throw new Error("No tienes acceso a esa empresa.");

  const admin = getSupabaseAdminClient();
  const { data: document, error: lookupError } = await admin
    .from("reusable_tender_documents")
    .select("id,storage_path")
    .eq("id", documentId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (lookupError) throw new Error(`No fue posible consultar el documento: ${lookupError.message}`);
  if (!document) throw new Error("El documento ya no existe o pertenece a otra empresa.");

  const { error: storageError } = await admin.storage.from("tender-documents").remove([document.storage_path]);
  if (storageError) throw new Error(`No fue posible borrar el archivo: ${storageError.message}`);
  const { error: metadataError } = await admin.from("reusable_tender_documents")
    .delete().eq("id", documentId).eq("company_id", companyId);
  if (metadataError) throw new Error(`No fue posible borrar el registro: ${metadataError.message}`);

  revalidatePath("/tenders/documents");
  revalidatePath("/commercial/setup");
}
