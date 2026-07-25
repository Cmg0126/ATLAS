"use server";

import { revalidatePath } from "next/cache";
import { dbDelete, dbInsert, dbSelect, dbUpdate, dbUpsert } from "@/lib/supabase-rest";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const number = (data: FormData, key: string) => text(data, key) ? Number(text(data, key)) : 0;
const nullableNumber = (data: FormData, key: string) => text(data, key) ? Number(text(data, key)) : null;
const nullable = (value: string) => value || null;
const list = (value: string) => value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
const required = (data: FormData, key: string, label: string) => {
  const value = text(data, key);
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
};

export async function saveRupProfile(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  await dbUpsert("rup_profiles", {
    company_id: companyId,
    issue_date: nullable(text(data, "issue_date")),
    valid_until: nullable(text(data, "valid_until")),
    fiscal_year: nullableNumber(data, "fiscal_year"),
    current_assets: number(data, "current_assets"),
    current_liabilities: number(data, "current_liabilities"),
    total_assets: number(data, "total_assets"),
    total_liabilities: number(data, "total_liabilities"),
    equity: number(data, "equity"),
    operating_profit: number(data, "operating_profit"),
    interest_expense: number(data, "interest_expense"),
    net_income: number(data, "net_income"),
    residual_capacity: number(data, "residual_capacity"),
    is_mipyme: data.get("is_mipyme") === "on",
    domicile: nullable(text(data, "domicile")),
    notes: nullable(text(data, "notes")),
    updated_at: new Date().toISOString(),
  }, "company_id");

  const rawExperiences = text(data, "rup_experiences_json");
  if (rawExperiences) {
    type ImportedExperience = {
      contract_number?: string; client?: string; contract_object?: string; completion_date?: string;
      value_cop?: string; value_smmlv?: string; unspsc_codes?: string[];
    };
    const imported = JSON.parse(rawExperiences) as ImportedExperience[];
    const existing = await dbSelect<{ id: string; contract_number: string | null }>("rup_experiences", {
      select: "id,contract_number", company_id: `eq.${companyId}`,
    });
    const byContract = new Map(existing.map((item) => [item.contract_number, item.id]));

    for (const experience of imported) {
      const contractNumber = String(experience.contract_number ?? "").trim();
      const client = String(experience.client ?? "").trim();
      if (!contractNumber || !client) continue;
      const record = {
        company_id: companyId,
        contract_number: contractNumber,
        client,
        contract_object: String(experience.contract_object ?? "").trim() || "Experiencia acreditada en RUP - objeto pendiente de completar",
        completion_date: nullable(String(experience.completion_date ?? "").trim()),
        value_cop: Number(experience.value_cop ?? 0) || 0,
        value_smmlv: Number(experience.value_smmlv ?? 0) || 0,
        unspsc_codes: Array.isArray(experience.unspsc_codes)
          ? experience.unspsc_codes.map((code) => String(code).replace(/\D/g, "")).filter(Boolean)
          : [],
      };
      const existingId = byContract.get(contractNumber);
      if (existingId) await dbUpdate("rup_experiences", { id: `eq.${existingId}`, company_id: `eq.${companyId}` }, record);
      else await dbInsert("rup_experiences", record);
    }
  }
  revalidatePath("/tenders/profile");
  revalidatePath("/tenders/secop");
}

export async function createRupExperience(data: FormData) {
  await dbInsert("rup_experiences", {
    company_id: required(data, "company_id", "La empresa"),
    contract_number: nullable(text(data, "contract_number")),
    client: required(data, "client", "El contratante"),
    contract_object: required(data, "contract_object", "El objeto"),
    completion_date: nullable(text(data, "completion_date")),
    value_cop: number(data, "value_cop"),
    value_smmlv: number(data, "value_smmlv"),
    unspsc_codes: list(text(data, "unspsc_codes")),
  });
  revalidatePath("/tenders/profile");
}

export async function deleteRupExperience(data: FormData) {
  await dbDelete("rup_experiences", { id: `eq.${required(data, "experience_id", "La experiencia")}` });
  revalidatePath("/tenders/profile");
}

type RupProfile = {
  current_assets: number; current_liabilities: number; total_assets: number; total_liabilities: number;
  equity: number; operating_profit: number; interest_expense: number; net_income: number;
};
type Experience = { value_smmlv: number; unspsc_codes: string[] };

export async function evaluateSecopRequirements(data: FormData) {
  const opportunityId = required(data, "secop_opportunity_id", "El proceso");
  const companyId = required(data, "company_id", "La empresa");
  const requirements = {
    required_liquidity: nullableNumber(data, "required_liquidity"),
    max_indebtedness: nullableNumber(data, "max_indebtedness"),
    min_interest_coverage: nullableNumber(data, "min_interest_coverage"),
    min_roe: nullableNumber(data, "min_roe"),
    min_roa: nullableNumber(data, "min_roa"),
    required_experience_smmlv: nullableNumber(data, "required_experience_smmlv"),
    required_experience_unspsc: list(text(data, "required_experience_unspsc")),
  };
  const [rup] = await dbSelect<RupProfile>("rup_profiles", {
    select: "current_assets,current_liabilities,total_assets,total_liabilities,equity,operating_profit,interest_expense,net_income",
    company_id: `eq.${companyId}`,
  });
  const experiences = await dbSelect<Experience>("rup_experiences", {
    select: "value_smmlv,unspsc_codes", company_id: `eq.${companyId}`,
  });

  const results: { pass: boolean | null; message: string }[] = [];
  const compareMinimum = (label: string, requiredValue: number | null, actual: number | null) => {
    if (requiredValue === null) return;
    if (actual === null || !Number.isFinite(actual)) results.push({ pass: null, message: `${label}: información RUP insuficiente` });
    else results.push({ pass: actual >= requiredValue, message: `${label}: ITLATAM ${actual.toFixed(2)} / mínimo ${requiredValue}` });
  };
  const compareMaximum = (label: string, requiredValue: number | null, actual: number | null) => {
    if (requiredValue === null) return;
    if (actual === null || !Number.isFinite(actual)) results.push({ pass: null, message: `${label}: información RUP insuficiente` });
    else results.push({ pass: actual <= requiredValue, message: `${label}: ITLATAM ${actual.toFixed(2)} / máximo ${requiredValue}` });
  };

  const liquidity = rup && Number(rup.current_liabilities) > 0 ? Number(rup.current_assets) / Number(rup.current_liabilities) : null;
  const indebtedness = rup && Number(rup.total_assets) > 0 ? Number(rup.total_liabilities) / Number(rup.total_assets) : null;
  const interestCoverage = rup && Number(rup.interest_expense) > 0 ? Number(rup.operating_profit) / Number(rup.interest_expense) : null;
  const roe = rup && Number(rup.equity) > 0 ? Number(rup.operating_profit) / Number(rup.equity) : null;
  const roa = rup && Number(rup.total_assets) > 0 ? Number(rup.operating_profit) / Number(rup.total_assets) : null;
  compareMinimum("Liquidez", requirements.required_liquidity, liquidity);
  compareMaximum("Endeudamiento", requirements.max_indebtedness, indebtedness);
  compareMinimum("Cobertura de intereses", requirements.min_interest_coverage, interestCoverage);
  compareMinimum("Rentabilidad del patrimonio", requirements.min_roe, roe);
  compareMinimum("Rentabilidad del activo", requirements.min_roa, roa);

  if (requirements.required_experience_smmlv !== null) {
    const codes = requirements.required_experience_unspsc.map((code) => code.replace(/\D/g, ""));
    const relevant = codes.length ? experiences.filter((experience) => experience.unspsc_codes.some((code) => codes.some((requiredCode) => code.replace(/\D/g, "").startsWith(requiredCode)))) : experiences;
    const actualExperience = relevant.reduce((sum, experience) => sum + Number(experience.value_smmlv), 0);
    results.push({
      pass: actualExperience >= requirements.required_experience_smmlv,
      message: `Experiencia: ITLATAM ${actualExperience.toFixed(2)} SMMLV / mínimo ${requirements.required_experience_smmlv}`,
    });
  }

  const failures = results.filter((result) => result.pass === false).length;
  const unknowns = results.filter((result) => result.pass === null).length;
  const passed = results.filter((result) => result.pass === true).length;
  const status = !results.length || unknowns ? "REVIEW" : failures ? "NOT_ELIGIBLE" : "ELIGIBLE";
  const score = results.length ? Math.round(passed / results.length * 100) : null;
  await dbUpdate("secop_opportunities", { id: `eq.${opportunityId}`, company_id: `eq.${companyId}` }, {
    ...requirements,
    eligibility_status: status,
    eligibility_score: score,
    eligibility_reasons: results.map((result) => `${result.pass === true ? "✓" : result.pass === false ? "✗" : "⚠"} ${result.message}`),
    requirements_reviewed_at: new Date().toISOString(),
  });
  revalidatePath("/tenders/secop");
}
