"use server";

import { revalidatePath } from "next/cache";
import { dbInsert } from "@/lib/supabase-rest";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string, label: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${label} es obligatorio.`);
  return result;
};
const normalizeKey = (parts: string[]) =>
  parts.join("|").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9|]+/g, " ").trim();

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
    category: value(data, "category") || null,
    brand: brand || null,
    model: model || null,
    unit: value(data, "unit") || "UND",
    tax_percent: Number(value(data, "tax_percent") || 19),
    item_type: value(data, "item_type") || "INSTALLABLE",
    keywords: value(data, "keywords") || null,
  });
  revalidatePath("/catalog");
}
