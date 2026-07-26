import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyProducts, type TaxonomySystem } from "@/lib/catalog-classifier";

export const runtime = "nodejs";
export const maxDuration = 60;

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type RequestProduct = {
  id: string; model: string; name: string; brand: string; stock: number;
  price: number; listPrice: number; imageUrl: string | null; category: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const body = await request.json() as { companyId?: string; product?: RequestProduct };
    if (!body.companyId || !body.product?.id || !body.product.name) {
      return NextResponse.json({ error: "Empresa y producto son obligatorios." }, { status: 400 });
    }
    const { data: membership } = await supabase.from("profiles").select("company_id")
      .eq("id", user.id).eq("company_id", body.companyId).eq("is_active", true).maybeSingle();
    if (!membership) return NextResponse.json({ error: "No tienes acceso a esa empresa." }, { status: 403 });
    const [{ data: company }, { data: taxonomy }] = await Promise.all([
      supabase.from("companies").select("default_tax_percent").eq("id", body.companyId).single(),
      supabase.from("product_systems")
        .select("id,name,product_categories(id,name,product_subcategories(id,name))")
        .eq("company_id", body.companyId).eq("active", true),
    ]);
    if (!company) return NextResponse.json({ error: "La empresa no existe." }, { status: 400 });

    let { data: supplier } = await supabase.from("suppliers").select("id")
      .eq("company_id", body.companyId).ilike("name", "SYSCOM Colombia").maybeSingle();
    if (!supplier) {
      const result = await supabase.from("suppliers").insert({
        company_id: body.companyId, name: "SYSCOM Colombia", status: "ACTIVE",
      }).select("id").single();
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
      supplier = result.data;
    }

    const product = body.product;
    const [classification] = await classifyProducts([{
      row: 1, reference: product.model || product.id, description: product.name,
      brand: product.brand, model: product.model,
    }], (taxonomy ?? []) as TaxonomySystem[]);
    const normalizedKey = normalize([product.brand, product.model, product.name].filter(Boolean).join("|"));
    const { data: saved, error: productError } = await supabase.from("catalog_products").upsert({
      company_id: body.companyId,
      internal_sku: null,
      normalized_key: normalizedKey,
      name: product.name,
      description: product.name,
      system_id: classification?.systemId ?? null,
      category_id: classification?.categoryId ?? null,
      subcategory_id: classification?.subcategoryId ?? null,
      classification_status: classification?.status ?? "PENDING",
      classification_confidence: classification?.confidence ?? 0,
      classification_source: classification?.source ?? "RULE",
      classified_at: classification?.subcategoryId ? new Date().toISOString() : null,
      brand: product.brand || classification?.brand || null,
      model: product.model || null,
      unit: "UND",
      tax_percent: Number(company.default_tax_percent ?? 19),
      item_type: "INSTALLABLE",
      keywords: [product.id, product.model, product.brand, product.name, product.category].filter(Boolean).join(" "),
      technical_attributes: {
        source: "SYSCOM", syscom_product_id: product.id, stock: product.stock,
        image_url: product.imageUrl, syscom_category: product.category,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,normalized_key" }).select("id").single();
    if (productError || !saved) return NextResponse.json({ error: productError?.message || "No se guardó el producto." }, { status: 400 });

    await supabase.from("supplier_prices").update({ active: false })
      .eq("product_id", saved.id).eq("supplier_id", supplier.id).eq("active", true);
    const { error: priceError } = await supabase.from("supplier_prices").insert({
      company_id: body.companyId, product_id: saved.id, supplier_id: supplier.id,
      supplier_sku: product.model || product.id, unit_price: product.price || product.listPrice,
      currency: "COP", tax_included: false, source_file: "API SYSCOM", active: true,
    });
    if (priceError) return NextResponse.json({ error: priceError.message }, { status: 400 });
    return NextResponse.json({ imported: true, productId: saved.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible importar el producto.";
    console.error(JSON.stringify({ level: "error", message: "syscom_import_failed", error: message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
