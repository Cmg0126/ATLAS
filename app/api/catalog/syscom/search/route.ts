import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchSyscomProducts } from "@/lib/syscom";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ error: "Escribe al menos dos caracteres." }, { status: 400 });
    return NextResponse.json({ products: await searchSyscomProducts(query) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible consultar SYSCOM.";
    console.error(JSON.stringify({ level: "error", message: "syscom_search_failed", error: message }));
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
