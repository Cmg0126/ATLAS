import { generateText, Output } from "ai";
import { z } from "zod";

export type TaxonomySystem = {
  id: string;
  name: string;
  product_categories: {
    id: string;
    name: string;
    product_subcategories: { id: string; name: string }[];
  }[];
};

export type ProductToClassify = {
  row: number;
  reference: string;
  description: string;
  brand: string;
  model: string;
};

export type ProductClassification = {
  row: number;
  systemId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  brand: string | null;
  confidence: number;
  status: "AUTOMATIC" | "REVIEW" | "PENDING";
  source: "AI" | "RULE";
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function findNode(taxonomy: TaxonomySystem[], systemName: string, categoryName: string, subcategoryName: string) {
  const system = taxonomy.find((item) => normalize(item.name) === normalize(systemName));
  const category = system?.product_categories.find((item) => normalize(item.name) === normalize(categoryName));
  const subcategory = category?.product_subcategories.find((item) => normalize(item.name) === normalize(subcategoryName));
  return {
    systemId: system?.id ?? null,
    categoryId: category?.id ?? null,
    subcategoryId: subcategory?.id ?? null,
  };
}

function inferBrand(product: ProductToClassify) {
  if (product.brand.trim()) return product.brand.trim();
  const reference = normalize([product.reference, product.model].join(" "));
  if (/\bdh[-\s]/.test(reference)) return "Dahua";
  if (/\bds[-\s]?\d/.test(reference)) return "Hikvision";
  return null;
}

function ruleClassification(product: ProductToClassify, taxonomy: TaxonomySystem[]): ProductClassification {
  const text = normalize([product.reference, product.description, product.brand, product.model].join(" "));
  let path: ReturnType<typeof findNode> = { systemId: null, categoryId: null, subcategoryId: null };
  let confidence = 0;

  if (/\b(camara|camera|bullet|bala|domo|dome|turret|ptz)\b/.test(text)) {
    path = findNode(taxonomy, "Seguridad Electrónica", "CCTV", "Cámaras");
    confidence = path.subcategoryId ? 0.92 : 0;
  } else if (/\b(nvr|network video recorder)\b/.test(text)) {
    path = findNode(taxonomy, "Seguridad Electrónica", "CCTV", "NVR");
    confidence = path.subcategoryId ? 0.95 : 0;
  } else if (/\b(soporte|base|bracket|mount|junction|caja de conexion|caja de conexiones)\b/.test(text)) {
    path = findNode(taxonomy, "Seguridad Electrónica", "CCTV", "Accesorios");
    confidence = path.subcategoryId ? 0.88 : 0;
  } else if (/\b(vms|licencia|license|software)\b/.test(text)) {
    path = findNode(taxonomy, "Seguridad Electrónica", "CCTV", "Software");
    confidence = path.subcategoryId ? 0.84 : 0;
  }

  return {
    row: product.row,
    ...path,
    brand: inferBrand(product),
    confidence,
    status: confidence >= 0.85 ? "AUTOMATIC" : confidence >= 0.6 ? "REVIEW" : "PENDING",
    source: "RULE",
  };
}

const classificationSchema = z.object({
  items: z.array(z.object({
    row: z.number().int(),
    systemId: z.string().nullable(),
    categoryId: z.string().nullable(),
    subcategoryId: z.string().nullable(),
    brand: z.string().max(120).nullable(),
    confidence: z.number().min(0).max(1),
  })),
});

function validateClassification(
  item: z.infer<typeof classificationSchema>["items"][number],
  taxonomy: TaxonomySystem[],
): ProductClassification {
  const system = taxonomy.find((candidate) => candidate.id === item.systemId);
  const category = system?.product_categories.find((candidate) => candidate.id === item.categoryId);
  const subcategory = category?.product_subcategories.find((candidate) => candidate.id === item.subcategoryId);
  const valid = Boolean(system && category && subcategory);
  const confidence = valid ? item.confidence : 0;
  return {
    row: item.row,
    systemId: valid ? system!.id : null,
    categoryId: valid ? category!.id : null,
    subcategoryId: valid ? subcategory!.id : null,
    brand: item.brand?.trim() || null,
    confidence,
    status: confidence >= 0.85 ? "AUTOMATIC" : confidence >= 0.6 ? "REVIEW" : "PENDING",
    source: "AI",
  };
}

export async function classifyProducts(
  products: ProductToClassify[],
  taxonomy: TaxonomySystem[],
): Promise<ProductClassification[]> {
  if (!products.length || !taxonomy.length) return products.map((product) => ruleClassification(product, taxonomy));
  try {
    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
      output: Output.object({ schema: classificationSchema }),
      system: [
        "Además de la clasificación, identifica la marca cuando la referencia, el modelo o la descripción permitan hacerlo con seguridad. Si no es segura, devuelve brand null.",
        "Eres el Motor ITLATAM para clasificar productos técnicos.",
        "Usa únicamente IDs presentes en la taxonomía suministrada.",
        "Clasifica usando referencia, descripción, marca y modelo.",
        "Si no puedes determinar los tres niveles con suficiente certeza, devuelve null en los tres IDs y confianza menor de 0.6.",
        "No inventes categorías. Accesorios de cámaras pertenecen a CCTV/Accesorios, no a Cámaras.",
      ].join(" "),
      prompt: JSON.stringify({ taxonomy, products }),
    });
    const byRow = new Map(output.items.map((item) => [item.row, validateClassification(item, taxonomy)]));
    return products.map((product) => byRow.get(product.row) ?? ruleClassification(product, taxonomy));
  } catch (error) {
    console.warn(JSON.stringify({
      level: "warning",
      message: "catalog_ai_classification_fallback",
      error: error instanceof Error ? error.message : String(error),
    }));
    return products.map((product) => ruleClassification(product, taxonomy));
  }
}
