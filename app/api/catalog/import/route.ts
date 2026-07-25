import { NextResponse } from "next/server";
import readXlsxFile from "read-excel-file/node";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const aliases = {
  sku: ["codigo", "código", "sku", "referencia", "ref", "part number", "partnumber"],
  name: ["descripcion", "descripción", "producto", "nombre", "articulo", "artículo", "detalle"],
  brand: ["marca", "fabricante"],
  model: ["modelo", "referencia fabricante", "modelo referencia"],
  unit: ["unidad", "und", "u.m.", "um"],
  price: ["precio", "precio unitario", "valor", "costo", "precio distribuidor", "precio neto"],
  tax: ["iva", "impuesto", "iva %"],
  category: ["categoria", "categoría", "familia", "grupo"],
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

function csvRows(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const form = await request.formData();
  const companyId = String(form.get("company_id") ?? "");
  const supplierId = String(form.get("supplier_id") ?? "");
  const file = form.get("file");
  if (!companyId || !supplierId || !(file instanceof File)) {
    return NextResponse.json({ error: "Empresa, proveedor y archivo son obligatorios." }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera 15 MB." }, { status: 400 });

  const extension = file.name.toLowerCase().split(".").pop();
  let rows: unknown[][] = [];
  if (extension === "csv") {
    rows = csvRows(await file.text());
  } else if (extension === "xlsx") {
    rows = await readXlsxFile(Buffer.from(await file.arrayBuffer())) as unknown as unknown[][];
  } else {
    return NextResponse.json({ error: "Formato no compatible. Usa .xlsx o .csv." }, { status: 400 });
  }

  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalize);
    return findColumn(headers, aliases.name) >= 0 && findColumn(headers, aliases.price) >= 0;
  });
  if (headerIndex < 0) return NextResponse.json({ error: "No encontré columnas de descripción y precio." }, { status: 400 });

  const headers = rows[headerIndex].map(normalize);
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, findColumn(headers, options)])) as Record<keyof typeof aliases, number>;
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const { data: importRecord, error: importError } = await supabase.from("price_list_imports").insert({
    company_id: companyId, supplier_id: supplierId, file_name: file.name, total_rows: dataRows.length, imported_by: user.id,
  }).select("id").single();
  if (importError) return NextResponse.json({ error: importError.message }, { status: 400 });

  let imported = 0;
  const errors: { row: number; message: string }[] = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const get = (key: keyof typeof aliases) => columns[key] >= 0 ? row[columns[key]] : "";
    const name = String(get("name") ?? "").trim();
    const price = parseMoney(get("price"));
    if (!name || !Number.isFinite(price) || price < 0) {
      errors.push({ row: headerIndex + index + 2, message: "Falta descripción o precio válido." });
      continue;
    }
    const sku = String(get("sku") ?? "").trim();
    const brand = String(get("brand") ?? "").trim();
    const model = String(get("model") ?? "").trim();
    const normalizedKey = normalize([brand, model, name].filter(Boolean).join("|"));
    const { data: product, error: productError } = await supabase.from("catalog_products").upsert({
      company_id: companyId, normalized_key: normalizedKey, internal_sku: null, name,
      description: name, category: String(get("category") ?? "").trim() || null,
      brand: brand || null, model: model || null, unit: String(get("unit") ?? "").trim() || "UND",
      tax_percent: Number(String(get("tax") ?? "19").replace(",", ".")) || 19,
      keywords: [sku, brand, model, name].filter(Boolean).join(" "),
    }, { onConflict: "company_id,normalized_key" }).select("id").single();
    if (productError || !product) {
      errors.push({ row: headerIndex + index + 2, message: productError?.message || "No se creó el producto." });
      continue;
    }
    await supabase.from("supplier_prices").update({ active: false }).eq("product_id", product.id).eq("supplier_id", supplierId).eq("active", true);
    const { error: priceError } = await supabase.from("supplier_prices").insert({
      company_id: companyId, product_id: product.id, supplier_id: supplierId, import_id: importRecord.id,
      supplier_sku: sku || null, unit_price: price, currency: "COP", source_file: file.name, active: true,
    });
    if (priceError) errors.push({ row: headerIndex + index + 2, message: priceError.message });
    else imported += 1;
  }
  await supabase.from("price_list_imports").update({
    status: errors.length === dataRows.length ? "FAILED" : "COMPLETED",
    imported_rows: imported, error_rows: errors.length, errors: errors.slice(0, 100),
  }).eq("id", importRecord.id);
  return NextResponse.json({ imported, errors: errors.length });
}
