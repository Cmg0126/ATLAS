export type ExtractedRup = {
  issue_date: string;
  valid_until: string;
  fiscal_year: string;
  current_assets: string;
  current_liabilities: string;
  total_assets: string;
  total_liabilities: string;
  equity: string;
  operating_profit: string;
  interest_expense: string;
  net_income: string;
  residual_capacity: string;
  domicile: string;
  is_mipyme: boolean;
  notes: string;
};

export type ExtractedRupExperience = {
  contract_number: string;
  client: string;
  contract_object: string;
  completion_date: string;
  value_cop: string;
  value_smmlv: string;
  unspsc_codes: string[];
};

const clean = (value: string) => value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();

const money = (value?: string) => {
  if (!value) return "";
  const normalized = value.replace(/[^\d,.-]/g, "");
  const decimalAt = Math.max(normalized.lastIndexOf(","), normalized.lastIndexOf("."));
  const decimalLength = decimalAt >= 0 ? normalized.length - decimalAt - 1 : 0;
  const hasDecimals = decimalLength > 0 && decimalLength <= 2;
  const integer = hasDecimals ? normalized.slice(0, decimalAt) : normalized;
  const decimals = hasDecimals ? normalized.slice(decimalAt + 1) : "";
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = integer.replace(/\D/g, "");
  return digits ? `${sign}${digits}${decimals ? `.${decimals}` : ""}` : "";
};

const capture = (source: string, labels: string[]) => {
  for (const label of labels) {
    const match = source.match(new RegExp(`${label}\\s*[:\\-]?\\s*\\$?\\s*([\\d.,()\\-]+)`, "i"));
    if (match?.[1]) {
      const signed = match[1].startsWith("(") ? `-${match[1]}` : match[1];
      return money(signed);
    }
  }
  return "";
};

const isoDate = (value?: string) => {
  const parts = value?.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  return parts ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}` : "";
};

const captureDate = (source: string, labels: string[]) => {
  for (const label of labels) {
    const match = source.match(new RegExp(`${label}[^\\d]{0,30}(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{4})`, "i"));
    if (match?.[1]) return isoDate(match[1]);
  }
  return "";
};

export function extractRupFromText(rawText: string): ExtractedRup {
  const source = clean(rawText);
  return {
    issue_date: captureDate(source, ["fecha de expedici[oó]n", "expedido el"]),
    valid_until: captureDate(source, ["vigente hasta", "fecha de vigencia", "renovaci[oó]n hasta"]),
    fiscal_year: source.match(/(?:informaci[oó]n\s+financiera|a[nñ]o\s+fiscal|vigencia)\D{0,40}(20\d{2})/i)?.[1] ?? "",
    current_assets: capture(source, ["activo corriente"]),
    current_liabilities: capture(source, ["pasivo corriente"]),
    total_assets: capture(source, ["activo total", "total activo"]),
    total_liabilities: capture(source, ["pasivo total", "total pasivo"]),
    equity: capture(source, ["patrimonio"]),
    operating_profit: capture(source, [
      "utilidad\\s*[/\\\\-]\\s*p[eé]rdida operacional",
      "utilidad operacional",
      "utilidad operativa",
    ]),
    interest_expense: capture(source, ["gastos de intereses", "gasto de intereses"]),
    net_income: capture(source, ["utilidad neta"]),
    residual_capacity: capture(source, ["capacidad residual de contrataci[oó]n", "capacidad residual"]),
    domicile: source.match(/domicilio(?:\s+principal)?\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.-]{2,50})/i)?.[1]?.trim() ?? "",
    is_mipyme: /\b(mipyme|microempresa|peque[nñ]a empresa|mediana empresa)\b/i.test(source),
    notes: "",
  };
}

export function extractRupExperiencesFromText(rawText: string): ExtractedRupExperience[] {
  const blocks = rawText.split(/\*{3}\s*EXPERIENCIA\s+No\.\s*/i).slice(1);

  return blocks.flatMap((block) => {
    const contractNumber = block.match(/N[ÚU]MERO\s+CONSECUTIVO\s+DEL\s+CONTRATO\s*:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "";
    const client = block.match(/NOMBRE\s+DEL\s+CONTRATANTE\s*:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "";
    const smmlv = block.match(/VALOR\s+CONTRATADO\s+EN\s+SMMLV\s*:\s*([\d.,]+)/i)?.[1] ?? "";
    const codes = [...block.matchAll(/\b(\d{2})\s+(\d{2})\s+(\d{2})\s+00\s*:/g)]
      .map((match) => `${match[1]}${match[2]}${match[3]}00`);

    if (!contractNumber || !client || !smmlv) return [];
    return [{
      contract_number: contractNumber,
      client,
      contract_object: "",
      completion_date: "",
      value_cop: "",
      value_smmlv: smmlv.replace(/\./g, "").replace(",", "."),
      unspsc_codes: [...new Set(codes)],
    }];
  });
}

export function extractedFieldCount(data: ExtractedRup) {
  return Object.entries(data).filter(([key, value]) => !["notes", "is_mipyme"].includes(key) && Boolean(value)).length;
}
