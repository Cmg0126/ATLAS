"use server";

import { revalidatePath } from "next/cache";
import { dbInsert, dbSelect, dbUpdate, dbUpsert } from "@/lib/supabase-rest";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string, label: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${label} es obligatorio.`);
  return result;
};
const normalizeKey = (parts: string[]) =>
  parts.join("|").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();
const normalizeName = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export async function createCatalogProduct(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const name = required(data, "name", "El producto");
  const brand = value(data, "brand");
  const model = value(data, "model");
  const internalSku = value(data, "internal_sku");
  await dbInsert("catalog_products", {
    company_id: companyId,
    internal_sku: internalSku || null,
    normalized_key: normalizeKey([brand, model, name]),
    name,
    description: value(data, "description") || null,
    system_id: value(data, "system_id") || null,
    category_id: value(data, "category_id") || null,
    subcategory_id: value(data, "subcategory_id") || null,
    classification_status: value(data, "subcategory_id") ? "REVIEWED" : "PENDING",
    classification_source: value(data, "subcategory_id") ? "MANUAL" : null,
    classification_confidence: value(data, "subcategory_id") ? 1 : null,
    classified_at: value(data, "subcategory_id") ? new Date().toISOString() : null,
    brand: brand || null,
    model: model || null,
    unit: value(data, "unit") || "UND",
    tax_percent: Number(value(data, "tax_percent") || 19),
    item_type: value(data, "item_type") || "INSTALLABLE",
    keywords: value(data, "keywords") || null,
  });
  revalidatePath("/catalog");
}

export async function createProductSystem(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const name = required(data, "name", "El sistema");
  await dbInsert("product_systems", {
    company_id: companyId,
    name,
    normalized_name: normalizeName(name),
    description: value(data, "description") || null,
  });
  revalidatePath("/catalog");
  revalidatePath("/catalog/settings");
}

export async function createProductCategory(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const systemId = required(data, "system_id", "El sistema");
  const [system] = await dbSelect<{ id: string }>("product_systems", {
    select: "id", id: `eq.${systemId}`, company_id: `eq.${companyId}`, limit: 1,
  });
  if (!system) throw new Error("El sistema no pertenece a la empresa.");
  const name = required(data, "name", "La categoría");
  await dbInsert("product_categories", {
    company_id: companyId,
    system_id: systemId,
    name,
    normalized_name: normalizeName(name),
    description: value(data, "description") || null,
  });
  revalidatePath("/catalog");
  revalidatePath("/catalog/settings");
}

export async function createProductSubcategory(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const categoryId = required(data, "category_id", "La categoría");
  const [category] = await dbSelect<{ id: string }>("product_categories", {
    select: "id", id: `eq.${categoryId}`, company_id: `eq.${companyId}`, limit: 1,
  });
  if (!category) throw new Error("La categoría no pertenece a la empresa.");
  const name = required(data, "name", "La subcategoría");
  await dbInsert("product_subcategories", {
    company_id: companyId,
    category_id: categoryId,
    name,
    normalized_name: normalizeName(name),
    description: value(data, "description") || null,
  });
  revalidatePath("/catalog");
  revalidatePath("/catalog/settings");
}

export async function updateProductClassification(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const productId = required(data, "product_id", "El producto");
  const systemId = value(data, "system_id");
  const categoryId = value(data, "category_id");
  const subcategoryId = value(data, "subcategory_id");
  const [product] = await dbSelect<{ id: string; brand: string | null; model: string | null }>("catalog_products", {
    select: "id,brand,model", id: `eq.${productId}`, company_id: `eq.${companyId}`, limit: 1,
  });
  if (!product) throw new Error("El producto no pertenece a la empresa.");
  if (subcategoryId) {
    const [path] = await dbSelect<{ id: string; category_id: string; product_categories: { system_id: string } }>("product_subcategories", {
      select: "id,category_id,product_categories(system_id)",
      id: `eq.${subcategoryId}`, company_id: `eq.${companyId}`, limit: 1,
    });
    if (!path || path.category_id !== categoryId || path.product_categories.system_id !== systemId) {
      throw new Error("La clasificación seleccionada no es válida.");
    }
  }
  await dbUpdate("catalog_products", { id: `eq.${productId}`, company_id: `eq.${companyId}` }, {
    system_id: systemId || null,
    category_id: categoryId || null,
    subcategory_id: subcategoryId || null,
    classification_status: subcategoryId ? "REVIEWED" : "PENDING",
    classification_source: subcategoryId ? "MANUAL" : null,
    classification_confidence: subcategoryId ? 1 : null,
    classified_at: subcategoryId ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (subcategoryId && product.brand && product.model) {
    await dbUpsert("catalog_classification_rules", {
      company_id: companyId,
      match_type: "BRAND_MODEL",
      match_value: normalizeName(`${product.brand}|${product.model}`),
      system_id: systemId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      confidence: 1,
      learned_from_product_id: productId,
      active: true,
    }, "company_id,match_type,match_value");
  }
  revalidatePath("/catalog");
}
