import { NextResponse } from "next/server";
import { readSheet } from "read-excel-file/node";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyProducts, type ProductClassification, type TaxonomySystem } from "@/lib/catalog-classifier";

export const runtime = "nodejs";
export const maxDuration = 60;

const aliases = {
  sku: ["codigo", "código", "sku", "referencia", "ref", "part number", "partnumber"],
  name: ["descripcion", "descripción", "producto", "nombre", "articulo", "artículo", "detalle"],
  brand: ["marca", "fabricante"],
  model: ["modelo", "referencia fabricante", "modelo referencia"],
  unit: ["unidad", "und", "u.m.", "um"],
  price: ["precio", "precio unitario", "valor", "costo", "precio distribuidor", "precio neto"],
  tax: ["iva", "impuesto", "iva %"],
} as const;

const normalize = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function findColumn(headers: string[], options: readonly string[]) {
  return headers.findIndex((header) => options.some((option) => header === normalize(option) || header.includes(normalize(option))));
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return value;
  let raw = String(value ?? "").replace(/[^\d.,-]/g, "");
  if (!raw) return NaN;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    raw = raw.replace(decimal === "," ? /\./g : /,/g, "").replace(decimal, ".");
  } else if (comma >= 0) {
    raw = /,\d{1,2}$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (dot >= 0) {
    raw = /\.\d{1,2}$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(/\./g, "");
  }
  return Number(raw);
}

function parseTaxPercent(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return 19;
  const raw = typeof value === "number"
    ? value
    : Number(String(value).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(raw) || raw < 0) return 19;
  const percent = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return percent <= 100 ? percent : 19;
}

function csvRows(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  return text.split(/\r?\n/).filter(Boolean).map((line) => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(value.trim()); value = ""; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  console.log(JSON.stringify({ level: "info", message: "catalog_import_started", requestId }));
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const form = await request.formData();
    const mode = String(form.get("mode") ?? "import");
    const companyId = String(form.get("company_id") ?? "");
    const supplierId = String(form.get("supplier_id") ?? "");
    const classificationMode = String(form.get("classification_mode") ?? "BLOCK") === "AI" ? "AI" : "BLOCK";
    const selectedSystemId = String(form.get("system_id") ?? "") || null;
    const selectedCategoryId = String(form.get("category_id") ?? "") || null;
    const selectedSubcategoryId = String(form.get("subcategory_id") ?? "") || null;
    const file = form.get("file");
    if (!companyId || !supplierId || !(file instanceof File)) return NextResponse.json({ error: "Empresa, proveedor y archivo son obligatorios." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera 15 MB." }, { status: 400 });

    const extension = file.name.toLowerCase().split(".").pop();
    let rows: unknown[][] = [];
    if (extension === "csv") rows = csvRows(await file.text());
    else if (extension === "xlsx") rows = await readSheet(Buffer.from(await file.arrayBuffer())) as unknown[][];
    else return NextResponse.json({ error: "Formato no compatible. Usa .xlsx o .csv." }, { status: 400 });
    if (!rows.length) return NextResponse.json({ error: "El archivo no contiene filas." }, { status: 400 });

    const detectedHeaderIndex = rows.findIndex((row) => {
      const headers = row.map(normalize);
      return findColumn(headers, aliases.name) >= 0 && findColumn(headers, aliases.price) >= 0;
    });
    const fallbackHeaderIndex = rows.slice(0, 20).reduce((best, row, index) => {
      const populated = row.filter((cell) => String(cell ?? "").trim()).length;
      return populated > best.populated ? { index, populated } : best;
    }, { index: 0, populated: 0 }).index;
    const requestedHeaderIndex = Number(form.get("header_index"));
    const headerIndex = Number.isInteger(requestedHeaderIndex) && requestedHeaderIndex >= 0
      ? requestedHeaderIndex : detectedHeaderIndex >= 0 ? detectedHeaderIndex : fallbackHeaderIndex;
    const headers = rows[headerIndex].map(normalize);
    const suggestedColumns = Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, findColumn(headers, options)])) as Record<keyof typeof aliases, number>;
    if (mode === "preview") {
      return NextResponse.json({
        headerIndex,
        headers: rows[headerIndex].map((cell, index) => String(cell ?? "").trim() || `Columna ${index + 1}`),
        suggestedMapping: suggestedColumns,
        previewRows: rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())).slice(0, 6)
          .map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? ""))),
      });
    }

    let columns = suggestedColumns;
    const rawMapping = form.get("mapping");
    if (typeof rawMapping === "string" && rawMapping) {
      const parsed = JSON.parse(rawMapping) as Partial<Record<keyof typeof aliases, number>>;
      columns = Object.fromEntries(Object.keys(aliases).map((key) => {
        const column = parsed[key as keyof typeof aliases];
        return [key, Number.isInteger(column) ? Number(column) : -1];
      })) as Record<keyof typeof aliases, number>;
    }
    if (columns.name < 0 || columns.price < 0) return NextResponse.json({ error: "Debes emparejar las columnas Descripción y Precio." }, { status: 400 });
    if (classificationMode === "BLOCK" && (!selectedSystemId || !selectedCategoryId || !selectedSubcategoryId)) {
      return NextResponse.json({ error: "Selecciona Sistema, Categoría y Subcategoría para importar por bloque." }, { status: 400 });
    }
    if (classificationMode === "BLOCK") {
      const { data: selectedPath } = await supabase.from("product_subcategories")
        .select("id,category_id,product_categories(system_id)")
        .eq("id", selectedSubcategoryId!)
        .eq("company_id", companyId)
        .maybeSingle();
      const parentCategory = Array.isArray(selectedPath?.product_categories)
        ? selectedPath.product_categories[0]
        : selectedPath?.product_categories;
      if (!selectedPath || selectedPath.category_id !== selectedCategoryId || parentCategory?.system_id !== selectedSystemId) {
        return NextResponse.json({ error: "La clasificación por bloque no pertenece a la empresa o no forma una ruta válida." }, { status: 400 });
      }
    }

    const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
    const parsedRows = dataRows.map((row, index) => {
      const get = (key: keyof typeof aliases) => columns[key] >= 0 ? row[columns[key]] : "";
      return {
        rowNumber: headerIndex + index + 2,
        name: String(get("name") ?? "").trim(),
        price: parseMoney(get("price")),
        sku: String(get("sku") ?? "").trim(),
        brand: String(get("brand") ?? "").trim(),
        model: String(get("model") ?? "").trim(),
        unit: String(get("unit") ?? "").trim() || "UND",
        taxPercent: parseTaxPercent(get("tax")),
      };
    });

    const classifications = new Map<number, ProductClassification>();
    if (classificationMode === "AI") {
      const [{ data: taxonomyData, error: taxonomyError }, { data: learnedRules }] = await Promise.all([
        supabase.from("product_systems")
          .select("id,name,product_categories(id,name,product_subcategories(id,name))")
          .eq("company_id", companyId).eq("active", true),
        supabase.from("catalog_classification_rules")
          .select("match_value,system_id,category_id,subcategory_id,confidence")
          .eq("company_id", companyId).eq("match_type", "BRAND_MODEL").eq("active", true),
      ]);
      if (taxonomyError) return NextResponse.json({ error: taxonomyError.message }, { status: 400 });
      const rules = new Map((learnedRules ?? []).map((rule) => [normalize(String(rule.match_value)), rule]));
      for (const item of parsedRows) {
        const rule = item.brand && item.model ? rules.get(normalize(`${item.brand}|${item.model}`)) : undefined;
        if (rule) classifications.set(item.rowNumber, {
          row: item.rowNumber,
          systemId: rule.system_id,
          categoryId: rule.category_id,
          subcategoryId: rule.subcategory_id,
          brand: item.brand || null,
          confidence: Number(rule.confidence),
          status: "AUTOMATIC",
          source: "RULE",
        });
      }
      const classifiable = parsedRows.filter((item) =>
        !classifications.has(item.rowNumber) && item.name && Number.isFinite(item.price) && item.price >= 0
      ).slice(0, 500)
        .map((item) => ({ row: item.rowNumber, reference: item.sku, description: item.name, brand: item.brand, model: item.model }));
      for (const classification of await classifyProducts(classifiable, (taxonomyData ?? []) as TaxonomySystem[])) {
        classifications.set(classification.row, classification);
      }
    }

    const { data: importRecord, error: importError } = await supabase.from("price_list_imports").insert({
      company_id: companyId, supplier_id: supplierId, file_name: file.name, total_rows: dataRows.length,
      imported_by: user.id, classification_mode: classificationMode, system_id: selectedSystemId,
      category_id: selectedCategoryId, subcategory_id: selectedSubcategoryId, column_mapping: columns,
    }).select("id").single();
    if (importError) return NextResponse.json({ error: importError.message }, { status: 400 });

    let imported = 0;
    const errors: { row: number; message: string }[] = [];
    for (const item of parsedRows) {
      if (!item.name || !Number.isFinite(item.price) || item.price < 0) {
        errors.push({ row: item.rowNumber, message: "Falta descripción o precio válido." });
        continue;
      }
      const classification = classificationMode === "BLOCK"
        ? { systemId: selectedSystemId, categoryId: selectedCategoryId, subcategoryId: selectedSubcategoryId, brand: item.brand || null, confidence: 1, status: "REVIEWED" as const, source: "BLOCK" as const }
        : classifications.get(item.rowNumber) ?? { systemId: null, categoryId: null, subcategoryId: null, brand: item.brand || null, confidence: 0, status: "PENDING" as const, source: "AI" as const };
      const resolvedBrand = item.brand || classification.brand || "";
      const normalizedKey = normalize([resolvedBrand, item.model, item.name].filter(Boolean).join("|"));
      const { data: product, error: productError } = await supabase.from("catalog_products").upsert({
        company_id: companyId, normalized_key: normalizedKey, internal_sku: null, name: item.name, description: item.name,
        system_id: classification.systemId, category_id: classification.categoryId, subcategory_id: classification.subcategoryId,
        classification_status: classification.status, classification_confidence: classification.confidence,
        classification_source: classification.source, classified_at: classification.subcategoryId ? new Date().toISOString() : null,
        classified_by: classificationMode === "BLOCK" ? user.id : null,
        brand: resolvedBrand || null, model: item.model || null, unit: item.unit, tax_percent: item.taxPercent,
        keywords: [item.sku, resolvedBrand, item.model, item.name].filter(Boolean).join(" "),
      }, { onConflict: "company_id,normalized_key" }).select("id").single();
      if (productError || !product) {
        errors.push({ row: item.rowNumber, message: productError?.message || "No se creó el producto." });
        continue;
      }
      await supabase.from("supplier_prices").update({ active: false }).eq("product_id", product.id).eq("supplier_id", supplierId).eq("active", true);
      const { error: priceError } = await supabase.from("supplier_prices").insert({
        company_id: companyId, product_id: product.id, supplier_id: supplierId, import_id: importRecord.id,
        supplier_sku: item.sku || null, unit_price: item.price, currency: "COP", source_file: file.name, active: true,
      });
      if (priceError) errors.push({ row: item.rowNumber, message: priceError.message });
      else imported += 1;
    }
    await supabase.from("price_list_imports").update({
      status: errors.length === dataRows.length ? "FAILED" : "COMPLETED",
      imported_rows: imported, error_rows: errors.length, errors: errors.slice(0, 100),
    }).eq("id", importRecord.id);
    console.log(JSON.stringify({
      level: "info", message: "catalog_import_completed", requestId, imported,
      errors: errors.length, classificationMode, durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json({
      imported,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
      failed: errors.length === dataRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", message: "catalog_import_failed", requestId, error: message, durationMs: Date.now() - startedAt }));
    return NextResponse.json({ error: `No fue posible leer la lista: ${message}` }, { status: 500 });
  }
}
