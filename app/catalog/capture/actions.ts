"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyProducts, type TaxonomySystem } from "@/lib/catalog-classifier";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function parsePrice(value: string) {
  const cleaned = value.replace(/[^\d.,-]/g, "");
  if (!cleaned) return NaN;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const decimalMark = comma > dot ? "," : dot > comma && cleaned.length - dot <= 3 ? "." : "";
  const normalized = decimalMark
    ? cleaned.slice(0, cleaned.lastIndexOf(decimalMark)).replace(/[.,]/g, "") + "." + cleaned.slice(cleaned.lastIndexOf(decimalMark) + 1)
    : cleaned.replace(/[.,]/g, "");
  return Number(normalized);
}

export async function saveCapturedProduct(data: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/catalog")}`);

  const companyId = text(data, "company_id");
  const code = text(data, "code");
  const model = text(data, "model") || code;
  const description = text(data, "description");
  const sourceUrl = text(data, "source_url");
  const unitPrice = parsePrice(text(data, "price"));
  if (!companyId || !code || !description || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("Empresa, código, descripción y precio válido son obligatorios.");
  }
  const parsedUrl = new URL(sourceUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "tienda.sonepar.co") {
    throw new Error("La fuente debe ser un producto de Sonepar Colombia.");
  }

  const [{ data: membership }, { data: company }, { data: taxonomy }] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", user.id).eq("company_id", companyId).eq("is_active", true).maybeSingle(),
    supabase.from("companies").select("default_tax_percent").eq("id", companyId).single(),
    supabase.from("product_systems").select("id,name,product_categories(id,name,product_subcategories(id,name))")
      .eq("company_id", companyId).eq("active", true),
  ]);
  if (!membership || !company) throw new Error("No tienes acceso a la empresa seleccionada.");

  let { data: supplier } = await supabase.from("suppliers").select("id")
    .eq("company_id", companyId).ilike("name", "Sonepar Colombia").maybeSingle();
  if (!supplier) {
    const created = await supabase.from("suppliers").insert({
      company_id: companyId, name: "Sonepar Colombia", status: "ACTIVE",
    }).select("id").single();
    if (created.error || !created.data) throw new Error(created.error?.message || "No se pudo crear el proveedor.");
    supplier = created.data;
  }

  const brand = text(data, "brand");
  const [classification] = await classifyProducts([{
    row: 1, reference: code, description, brand, model,
  }], (taxonomy ?? []) as TaxonomySystem[]);
  const normalizedKey = normalize([brand || classification?.brand || "", model, description].join("|"));
  const { data: existingPrice } = await supabase.from("supplier_prices").select("product_id")
    .eq("company_id", companyId).eq("supplier_id", supplier.id).eq("supplier_sku", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const productValues = {
    company_id: companyId,
    normalized_key: normalizedKey,
    name: description,
    description,
    brand: brand || classification?.brand || null,
    model,
    unit: text(data, "unit") || "UND",
    tax_percent: Number(company.default_tax_percent ?? 19),
    item_type: "INSTALLABLE",
    keywords: [code, model, brand, description].filter(Boolean).join(" "),
    system_id: classification?.systemId ?? null,
    category_id: classification?.categoryId ?? null,
    subcategory_id: classification?.subcategoryId ?? null,
    classification_status: classification?.status ?? "PENDING",
    classification_confidence: classification?.confidence ?? 0,
    classification_source: classification?.source ?? "RULE",
    classified_at: classification?.subcategoryId ? new Date().toISOString() : null,
    technical_attributes: {
      source: "SONEPAR", source_url: sourceUrl, source_code: code, captured_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
  let productId = existingPrice?.product_id;
  if (productId) {
    const updated = await supabase.from("catalog_products").update(productValues).eq("id", productId).eq("company_id", companyId);
    if (updated.error) throw new Error(updated.error.message);
  } else {
    const saved = await supabase.from("catalog_products").upsert(productValues, {
      onConflict: "company_id,normalized_key",
    }).select("id").single();
    if (saved.error || !saved.data) throw new Error(saved.error?.message || "No se pudo guardar el producto.");
    productId = saved.data.id;
  }

  await supabase.from("supplier_prices").update({ active: false })
    .eq("company_id", companyId).eq("supplier_id", supplier.id).eq("product_id", productId).eq("active", true);
  const priceResult = await supabase.from("supplier_prices").insert({
    company_id: companyId, product_id: productId, supplier_id: supplier.id,
    supplier_sku: code, unit_price: unitPrice, currency: "COP", tax_included: false,
    source_file: sourceUrl, active: true,
  });
  if (priceResult.error) throw new Error(priceResult.error.message);
  redirect("/catalog");
}
