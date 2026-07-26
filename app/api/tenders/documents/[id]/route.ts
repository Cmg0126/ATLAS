import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: document } = await supabase.from("reusable_tender_documents")
    .select("storage_path").eq("id", id).maybeSingle();
  if (!document) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  const { data, error } = await getSupabaseAdminClient().storage.from("tender-documents")
    .createSignedUrl(document.storage_path, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "No fue posible abrir el documento." }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
