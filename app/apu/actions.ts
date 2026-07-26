"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbDelete, dbInsert, dbSelect, dbUpdate } from "@/lib/supabase-rest";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const numeric = (data: FormData, key: string, fallback = 0) => {
  const parsed = Number(value(data, key));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const allowedItemTypes = new Set(["EQUIPMENT", "MATERIAL", "LABOR"]);
const savedRedirect = (apuId: string, message: string) =>
  redirect(`/apu/${apuId}?saved=${encodeURIComponent(message)}`);
const resourcesRedirect = (message: string) =>
  redirect(`/apu/resources?saved=${encodeURIComponent(message)}`);

type ApuResource = {
  id: string;
  resource_type: string;
  catalog_product_id: string | null;
  code: string | null;
  description: string;
  unit: string;
  default_unit_cost: number;
};

async function saveReusableResource({
  companyId,
  itemType,
  catalogProductId,
  code,
  description,
  unit,
  unitCost,
}: {
  companyId: string;
  itemType: string;
  catalogProductId: string | null;
  code: string | null;
  description: string;
  unit: string;
  unitCost: number;
}) {
  const identityKey = (code || description).trim().toLowerCase();
  const [existing] = await dbSelect<ApuResource>("apu_resources", {
    select: "id,resource_type,catalog_product_id,code,description,unit,default_unit_cost",
    company_id: `eq.${companyId}`,
    resource_type: `eq.${itemType}`,
    identity_key: `eq.${identityKey}`,
    limit: 1,
  });
  if (existing) {
    await dbUpdate("apu_resources", { id: `eq.${existing.id}`, company_id: `eq.${companyId}` }, {
      catalog_product_id: catalogProductId || existing.catalog_product_id,
      code,
      description,
      unit,
      default_unit_cost: unitCost,
      active: true,
      updated_at: new Date().toISOString(),
    });
    return existing.id;
  }
  const resource = await dbInsert<{ id: string }>("apu_resources", {
    company_id: companyId,
    resource_type: itemType,
    catalog_product_id: catalogProductId,
    code,
    description,
    unit,
    default_unit_cost: unitCost,
  });
  return resource.id;
}

async function recalculate(apuId: string, companyId: string) {
  const [apu] = await dbSelect<{ administration_percent: number; contingency_percent: number; profit_percent: number; tax_on_profit_percent: number }>("apu_templates", {
    select: "administration_percent,contingency_percent,profit_percent,tax_on_profit_percent", id: `eq.${apuId}`, company_id: `eq.${companyId}`, limit: 1,
  });
  if (!apu) throw new Error("El APU no existe.");
  const items = await dbSelect<{ subtotal: number }>("apu_items", { select: "subtotal", apu_id: `eq.${apuId}`, company_id: `eq.${companyId}` });
  const direct = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const administration = direct * Number(apu.administration_percent || 0) / 100;
  const contingency = direct * Number(apu.contingency_percent || 0) / 100;
  const profit = direct * Number(apu.profit_percent || 0) / 100;
  const tax = profit * Number(apu.tax_on_profit_percent || 0) / 100;
  await dbUpdate("apu_templates", { id: `eq.${apuId}`, company_id: `eq.${companyId}` }, {
    direct_cost: direct, administration_cost: administration, contingency_cost: contingency,
    profit_cost: profit, tax_cost: tax, unit_price: direct + administration + contingency + profit + tax,
    updated_at: new Date().toISOString(),
  });
}

export async function createApu(data: FormData) {
  const companyId = value(data, "company_id");
  const code = value(data, "code");
  const name = value(data, "name");
  if (!companyId || !code || !name) throw new Error("Empresa, código y nombre son obligatorios.");
  const apu = await dbInsert<{ id: string }>("apu_templates", {
    company_id: companyId, code, name, description: value(data, "description") || null,
    unit: value(data, "unit") || "UND", status: "DRAFT",
    administration_percent: numeric(data, "administration_percent"),
    contingency_percent: numeric(data, "contingency_percent"),
    profit_percent: numeric(data, "profit_percent"),
    tax_on_profit_percent: numeric(data, "tax_on_profit_percent", 19),
  });
  redirect(`/apu/${apu.id}`);
}

export async function updateApu(data: FormData) {
  const apuId = value(data, "apu_id");
  const companyId = value(data, "company_id");
  await dbUpdate("apu_templates", { id: `eq.${apuId}`, company_id: `eq.${companyId}` }, {
    name: value(data, "name"), description: value(data, "description") || null,
    unit: value(data, "unit") || "UND", status: value(data, "status") || "DRAFT",
    administration_percent: numeric(data, "administration_percent"),
    contingency_percent: numeric(data, "contingency_percent"),
    profit_percent: numeric(data, "profit_percent"),
    tax_on_profit_percent: numeric(data, "tax_on_profit_percent", 19),
    updated_at: new Date().toISOString(),
  });
  await recalculate(apuId, companyId);
  revalidatePath("/apu");
  revalidatePath(`/apu/${apuId}`);
  savedRedirect(apuId, "Datos del APU guardados y totales recalculados.");
}

export async function addApuItem(data: FormData) {
  const apuId = value(data, "apu_id");
  const companyId = value(data, "company_id");
  const productId = value(data, "catalog_product_id");
  const selectedResourceId = value(data, "apu_resource_id");
  let description = value(data, "description");
  let unit = value(data, "unit") || "UND";
  let unitCost = numeric(data, "unit_cost");
  let supplierPriceId: string | null = null;
  let code = value(data, "code") || null;
  let resourceId: string | null = null;
  let catalogProductId: string | null = productId || null;
  let itemType = value(data, "item_type");
  if (selectedResourceId) {
    const [resource] = await dbSelect<ApuResource>("apu_resources", {
      select: "id,resource_type,catalog_product_id,code,description,unit,default_unit_cost",
      id: `eq.${selectedResourceId}`,
      company_id: `eq.${companyId}`,
      active: "eq.true",
      limit: 1,
    });
    if (!resource) throw new Error("El recurso reutilizable no existe o está inactivo.");
    itemType = resource.resource_type;
    resourceId = resource.id;
    catalogProductId = resource.catalog_product_id;
    description = resource.description;
    unit = resource.unit;
    code = resource.code;
    if (unitCost <= 0) unitCost = Number(resource.default_unit_cost);
  } else if (productId) {
    const [product] = await dbSelect<{ internal_sku: string | null; name: string; unit: string; supplier_prices: { id: string; unit_price: number; active: boolean; created_at: string }[] }>("catalog_products", {
      select: "internal_sku,name,unit,supplier_prices(id,unit_price,active,created_at)", id: `eq.${productId}`, company_id: `eq.${companyId}`, limit: 1,
    });
    if (!product) throw new Error("El producto no pertenece a la empresa.");
    const latest = (product.supplier_prices || []).filter((price) => price.active).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    description = product.name;
    unit = product.unit;
    code = product.internal_sku;
    if (latest) {
      supplierPriceId = latest.id;
      if (unitCost <= 0) unitCost = Number(latest.unit_price);
    }
  }
  if (!allowedItemTypes.has(itemType)) throw new Error("Selecciona el grupo del recurso.");
  if (!description) throw new Error("Selecciona un producto o escribe una descripción.");
  if (!resourceId) {
    resourceId = await saveReusableResource({
      companyId,
      itemType,
      catalogProductId,
      code,
      description,
      unit,
      unitCost,
    });
  }
  const quantity = Math.max(0, numeric(data, "quantity", 1));
  await dbInsert("apu_items", {
    company_id: companyId, apu_id: apuId, item_type: itemType,
    resource_id: resourceId, catalog_product_id: catalogProductId, supplier_price_id: supplierPriceId, code, description, unit,
    quantity, performance: 1, waste_percent: 0, unit_cost: unitCost,
    subtotal: quantity * unitCost, notes: value(data, "notes") || null,
  });
  await recalculate(apuId, companyId);
  revalidatePath(`/apu/${apuId}`);
  savedRedirect(apuId, "Recurso agregado y APU recalculado.");
}

export async function updateApuItem(data: FormData) {
  const apuId = value(data, "apu_id");
  const companyId = value(data, "company_id");
  const itemId = value(data, "item_id");
  const itemType = value(data, "item_type");
  const description = value(data, "description");
  if (!allowedItemTypes.has(itemType)) throw new Error("El grupo del recurso no es válido.");
  if (!description) throw new Error("La descripción es obligatoria.");
  const quantity = Math.max(0, numeric(data, "quantity", 1));
  const unitCost = Math.max(0, numeric(data, "unit_cost"));
  await dbUpdate("apu_items", {
    id: `eq.${itemId}`, apu_id: `eq.${apuId}`, company_id: `eq.${companyId}`,
  }, {
    item_type: itemType,
    code: value(data, "code") || null,
    description,
    unit: value(data, "unit") || "UND",
    quantity,
    performance: 1,
    waste_percent: 0,
    unit_cost: unitCost,
    subtotal: quantity * unitCost,
    updated_at: new Date().toISOString(),
  });
  await recalculate(apuId, companyId);
  revalidatePath(`/apu/${apuId}`);
  savedRedirect(apuId, "Recurso actualizado y APU recalculado.");
}

export async function deleteApuItem(data: FormData) {
  const apuId = value(data, "apu_id");
  const companyId = value(data, "company_id");
  await dbDelete("apu_items", { id: `eq.${value(data, "item_id")}`, apu_id: `eq.${apuId}`, company_id: `eq.${companyId}` });
  await recalculate(apuId, companyId);
  revalidatePath(`/apu/${apuId}`);
  savedRedirect(apuId, "Recurso eliminado y APU recalculado.");
}

export async function createApuResource(data: FormData) {
  const companyId = value(data, "company_id");
  const resourceType = value(data, "resource_type");
  const description = value(data, "description");
  if (!companyId || !allowedItemTypes.has(resourceType) || !description) {
    throw new Error("Empresa, grupo y descripción son obligatorios.");
  }
  await saveReusableResource({
    companyId,
    itemType: resourceType,
    catalogProductId: null,
    code: value(data, "code") || null,
    description,
    unit: value(data, "unit") || "UND",
    unitCost: Math.max(0, numeric(data, "default_unit_cost")),
  });
  revalidatePath("/apu/resources");
  resourcesRedirect("Recurso guardado en la biblioteca.");
}

export async function updateApuResource(data: FormData) {
  const companyId = value(data, "company_id");
  const resourceId = value(data, "resource_id");
  const resourceType = value(data, "resource_type");
  const description = value(data, "description");
  if (!allowedItemTypes.has(resourceType) || !description) {
    throw new Error("Grupo y descripción son obligatorios.");
  }
  await dbUpdate("apu_resources", {
    id: `eq.${resourceId}`,
    company_id: `eq.${companyId}`,
  }, {
    resource_type: resourceType,
    code: value(data, "code") || null,
    description,
    unit: value(data, "unit") || "UND",
    default_unit_cost: Math.max(0, numeric(data, "default_unit_cost")),
    active: value(data, "active") === "true",
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/apu/resources");
  resourcesRedirect("Recurso actualizado.");
}

export async function duplicateApu(data: FormData) {
  const apuId = value(data, "apu_id");
  const companyId = value(data, "company_id");
  const [source] = await dbSelect<Record<string, unknown>>("apu_templates", { select: "*", id: `eq.${apuId}`, company_id: `eq.${companyId}`, limit: 1 });
  if (!source) throw new Error("El APU no existe.");
  const versions = await dbSelect<{ version: number }>("apu_templates", { select: "version", company_id: `eq.${companyId}`, code: `eq.${String(source.code)}`, order: "version.desc", limit: 1 });
  const { id: _id, created_at: _created, updated_at: _updated, ...copy } = source;
  const duplicated = await dbInsert<{ id: string }>("apu_templates", {
    ...copy, version: Number(versions[0]?.version || 0) + 1, status: "DRAFT", source_apu_id: apuId,
  });
  const items = await dbSelect<Record<string, unknown>>("apu_items", { select: "*", apu_id: `eq.${apuId}`, company_id: `eq.${companyId}` });
  for (const item of items) {
    const { id: _itemId, created_at: _itemCreated, updated_at: _itemUpdated, ...itemCopy } = item;
    await dbInsert("apu_items", { ...itemCopy, apu_id: duplicated.id });
  }
  redirect(`/apu/${duplicated.id}`);
}
