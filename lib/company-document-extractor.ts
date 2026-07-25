import "server-only";

async function preparePdfRuntime() {
  const canvas = await import("@napi-rs/canvas");
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix as typeof DOMMatrix;
  if (!globalThis.ImageData) globalThis.ImageData = canvas.ImageData as unknown as typeof ImageData;
  if (!globalThis.Path2D) globalThis.Path2D = canvas.Path2D as unknown as typeof Path2D;
}

export async function extractPdfText(data: Uint8Array) {
  await preparePdfRuntime();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    return (await parser.getText()).text.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

const clean = (value?: string) => value?.replace(/\s+/g, " ").trim().replace(/^[:.-]+\s*/, "") || "";
const first = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const value = clean(text.match(pattern)?.[1]);
    if (value) return value;
  }
  return "";
};

export function extractCompanyDocument(text: string, category: string) {
  const result: Record<string, string> = {};
  const put = (key: string, patterns: RegExp[]) => {
    const value = first(text, patterns);
    if (value) result[key] = value;
  };

  put("legal_name", [
    /Raz[oó]n social\s*:?\s*\n?([^\n]+)/i,
    /Nombre o raz[oó]n social\s*:?\s*\n?([^\n]+)/i,
  ]);
  put("trade_name", [/Nombre comercial\s*:?\s*\n?([^\n]+)/i]);
  put("nit", [
    /NIT\s*:?\s*(\d[\d.\s-]{6,})/i,
    /N[uú]mero de Identificaci[oó]n Tributaria\s*\(NIT\)\s*:?\s*(\d[\d.\s-]{6,})/i,
  ]);
  put("verification_digit", [/(?:DV|D[ií]gito de verificaci[oó]n)\s*:?\s*(\d)/i]);
  put("address", [
    /Direcci[oó]n principal\s*:?\s*\n?([^\n]+)/i,
    /Direcci[oó]n del domicilio principal\s*:?\s*\n?([^\n]+)/i,
  ]);
  put("city", [/(?:Municipio|Ciudad)\s*:?\s*\n?([^\n]+)/i]);
  put("department", [/Departamento\s*:?\s*\n?([^\n]+)/i]);
  put("email", [/Correo electr[oó]nico\s*:?\s*\n?([^\s\n]+@[^\s\n]+)/i]);
  put("phone", [/(?:Tel[eé]fono|Tel[eé]fonos)\s*:?\s*\n?([\d +()-]{7,})/i]);
  put("legal_representative", [
    /Representante legal\s*:?\s*\n?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{4,})/i,
    /Nombre del representante legal\s*:?\s*\n?([^\n]+)/i,
  ]);
  put("representative_document", [
    /Identificaci[oó]n del representante legal\s*:?\s*\n?([^\n]+)/i,
    /C[eé]dula(?: de ciudadan[ií]a)?\s*(?:No\.?|N[uú]mero)?\s*:?\s*([\d.]+)/i,
  ]);
  put("chamber_registration", [
    /Matr[ií]cula(?: mercantil)?\s*(?:No\.?|N[uú]mero)?\s*:?\s*([\w-]+)/i,
  ]);
  put("tax_regime", [/R[eé]gimen\s*:?\s*\n?([^\n]+)/i]);

  const responsibilities = [...text.matchAll(/(?:Responsabilidad|C[oó]digo)\s*:?\s*(\d{2})\s*[-–]\s*([^\n]+)/gi)]
    .slice(0, 20).map((match) => `${match[1]} - ${clean(match[2])}`).join("\n");
  if (responsibilities) result.tax_responsibilities = responsibilities;

  const ciiu = [...text.matchAll(/(?:Actividad econ[oó]mica|C[oó]digo CIIU)[^\d]{0,40}(\d{4})\s*[-–:]?\s*([^\n]*)/gi)]
    .map((match) => ({ code: match[1], description: clean(match[2]) }))
    .filter((item, index, all) => all.findIndex((other) => other.code === item.code) === index);

  return { fields: result, ciiu, source: category };
}
