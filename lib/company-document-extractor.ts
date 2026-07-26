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
const moneyValue = (value: string) => value.replace(/\./g, "").replace(",", ".");
const spanishDate = (value: string) => {
  const months: Record<string, string> = { enero:"01",febrero:"02",marzo:"03",abril:"04",mayo:"05",junio:"06",julio:"07",agosto:"08",septiembre:"09",octubre:"10",noviembre:"11",diciembre:"12" };
  const match = value.toLocaleLowerCase("es").match(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/);
  return match && months[match[2]] ? `${match[3]}-${months[match[2]]}-${match[1].padStart(2,"0")}` : value;
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
  put("chamber_of_commerce", [/C[aá]mara de Comercio de\s+([^\n]+)/i]);
  put("company_duration", [/(?:Duraci[oó]n|Vigencia de la sociedad)\s*:?\s*\n?([^\n]+)/i]);
  put("chamber_registration_date", [/Fecha (?:de )?matr[ií]cula\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i]);
  put("chamber_renewal_date", [/(?:Fecha de renovaci[oó]n|[ÚU]ltima renovaci[oó]n)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i]);
  put("authorized_capital", [/Capital autorizado\s*:?\s*\$?\s*([\d.,]+)/i]);
  put("subscribed_capital", [/Capital suscrito\s*:?\s*\$?\s*([\d.,]+)/i]);
  put("paid_in_capital", [/Capital pagado\s*:?\s*\$?\s*([\d.,]+)/i]);
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
  if (category === "CAMARA_COMERCIO") {
    put("legal_name", [/Raz[oó]n Social\s*:\s*([^\n]+)/i]);
    const nit = first(text, [/Nit\s*:\s*([\d.-]+)/i]).replace(/\D/g,"");
    if (nit.length >= 10) { result.nit=nit.slice(0,9); result.verification_digit=nit.slice(9,10); }
    put("chamber_registration", [/Matr[ií]cula No\s*:\s*([^\n]+)/i]);
    const registrationDate=first(text,[/Fecha de matr[ií]cula\s*:\s*([^\n]+)/i]);
    if(registrationDate)result.chamber_registration_date=spanishDate(registrationDate);
    const renewalDate=first(text,[/Fecha de renovaci[oó]n\s*:\s*([^\n]+)/i]);
    if(renewalDate)result.chamber_renewal_date=spanishDate(renewalDate);
    put("chamber_last_renewed_year",[/[ÚU]ltimo a[nñ]o renovado\s*:\s*(\d{4})/i]);
    put("niif_group",[/Grupo NIIF\s*:\s*([^\n]+)/i]);
    put("address",[/Direcci[oó]n del domicilio principal\s*:\s*([^\n]+)/i]);
    put("email",[/Correo electr[oó]nico\s*:\s*([^\n]+)/i]);
    put("phone",[/Tel[eé]fono comercial 1\s*:\s*([^\n]+)/i]);
    result.company_duration=/duraci[oó]n es indefinida/i.test(text)?"Indefinida":result.company_duration;
    const purpose=text.match(/OBJETO SOCIAL\s+([\s\S]*?)\s+CAPITAL/i)?.[1];
    if(purpose)result.corporate_purpose=clean(purpose.replace(/Página \d+ de \d+[\s\S]*?-- \d+ of \d+ --/g," "));
    const capital=(label:string)=>first(text,[new RegExp(`CAPITAL ${label} \\\\*?[\\\\s\\\\S]{0,80}?Valor \\\\$ ([\\\\d.,]+)`,"i")]);
    const authorized=capital("AUTORIZADO"); const subscribed=capital("SUSCRITO"); const paid=capital("PAGADO");
    if(authorized)result.authorized_capital=moneyValue(authorized);
    if(subscribed)result.subscribed_capital=moneyValue(subscribed);
    if(paid)result.paid_in_capital=moneyValue(paid);
    const reps=text.match(/REPRESENTANTE LEGAL PRINCIPAL\s+(.+?)\s+C\.C\. No\. ([\d.]+)[\s\S]*?REPRESENTANTE LEGAL SUPLENTE\s+(.+?)\s+C\.C\. No\. ([\d.]+)/i);
    if(reps){result.legal_representative=clean(reps[1]);result.representative_document=reps[2];result.alternate_legal_representative=clean(reps[3]);result.alternate_representative_document=reps[4];}
    put("company_size",[/tama[nñ]o de la empresa es\s+([^.]+)/i]);
    const income=first(text,[/Ingresos por actividad ordinaria\s*:\s*\$([\d.,]+)/i]); if(income)result.ordinary_income=moneyValue(income);
    result.control_situation=/SITUACION DE CONTROL - CONTROLANTE/i.test(text)?"Situación de control registrada; controlante: GLORIA LEONOR OSORIO GIRALDO":result.control_situation;
    for(const match of text.matchAll(/C[oó]digo CIIU:\s*[A-Z]?(\d{4})/gi)){if(!ciiu.some(x=>x.code===match[1]))ciiu.push({code:match[1],description:""});}
  }

  return { fields: result, ciiu, source: category };
}
