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

  if (category === "RUT") {
    const lines = text.split("\n").map(clean).filter(Boolean);
    const identificationLine = lines.find((line) => /Impuestos de/i.test(line) && (line.match(/\d/g)?.length ?? 0) >= 10);
    const identification = identificationLine?.match(/\d/g)?.join("").slice(0, 10);
    if (identification?.length === 10) {
      result.nit = identification.slice(0, 9);
      result.verification_digit = identification.slice(9);
    }
    const legalIndex = lines.findIndex((line) => /^Persona jur[ií]dica\b/i.test(line));
    if (legalIndex >= 0) {
      result.entity_type = "Persona jurídica";
      if (lines[legalIndex + 1]) result.legal_name = lines[legalIndex + 1];
      if (lines[legalIndex + 2]) result.trade_name = lines[legalIndex + 2];
      const location = lines[legalIndex + 3] || "";
      const department = location.match(/COLOMBIA(?:\s+\d+)+\s+([A-Za-zÁÉÍÓÚÑáéíóúñ ]+?)(?:\s+\d+)+\s+([A-Za-zÁÉÍÓÚÑáéíóúñ ]+?)(?:\s+\d+)*$/i);
      if (department) {
        result.department = clean(department[1]);
        result.city = clean(department[2]);
      }
      if (lines[legalIndex + 4]) result.address = lines[legalIndex + 4];
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lines[legalIndex + 5] || "")) result.email = lines[legalIndex + 5];
      const activityDigits = (lines[legalIndex + 7] || "").replace(/\D/g, "");
      const activityCodes = [
        activityDigits.slice(0, 4),
        activityDigits.slice(12, 16),
        activityDigits.slice(24, 28),
        activityDigits.slice(28, 32),
      ].filter((code) => /^\d{4}$/.test(code));
      for (const code of activityCodes) {
        if (!ciiu.some((item) => item.code === code)) ciiu.push({ code, description: "" });
      }
    }
    const representative = text.match(/\n([A-ZÁÉÍÓÚÑ ]{8,})\nRepresentante legal Certificado/i)?.[1];
    if (representative) result.legal_representative = clean(representative);
    const rutResponsibilities = [...text.matchAll(/\n(\d{2})\s*-\s*([^\n]+)/g)]
      .filter((match) => ["47", "48", "52"].includes(match[1]))
      .map((match) => `${match[1]} - ${clean(match[2])}`);
    if (rutResponsibilities.length) {
      result.tax_responsibilities = [...new Set(rutResponsibilities)].join("\n");
      result.tax_regime = rutResponsibilities.find((item) => item.startsWith("47 -")) || result.tax_regime;
    }
  }

  return { fields: result, ciiu, source: category };
}
