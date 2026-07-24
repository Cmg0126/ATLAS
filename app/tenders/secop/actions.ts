"use server";

import { revalidatePath } from "next/cache";
import { dbInsert, dbSelect, dbUpdate, dbUpsert } from "@/lib/supabase-rest";
import { defaultSecopProfile } from "./profile";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const list = (value: string) => value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
const numeric = (value: string) => value ? Number(value) : 0;
const required = (data: FormData, key: string, label: string) => {
  const value = text(data, key);
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
};

type SecopProfile = typeof defaultSecopProfile & { id: string; company_id: string };
type SecopRow = {
  id_del_proceso?: string;
  referencia_del_proceso?: string;
  nombre_del_procedimiento?: string;
  descripci_n_del_procedimiento?: string;
  entidad?: string;
  departamento_entidad?: string;
  ciudad_entidad?: string;
  fase?: string;
  precio_base?: string;
  modalidad_de_contratacion?: string;
  fecha_de_publicacion_del?: string;
  fecha_de_recepcion_de?: string;
  estado_del_procedimiento?: string;
  codigo_principal_de_categoria?: string;
  categorias_adicionales?: string;
  urlproceso?: { url?: string };
};

const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function scoreRow(row: SecopRow, profile: SecopProfile) {
  const haystack = normalize(`${row.nombre_del_procedimiento ?? ""} ${row.descripci_n_del_procedimiento ?? ""}`);
  const excluded = profile.excluded_keywords.filter((keyword) => haystack.includes(normalize(keyword)));
  if (excluded.length) return { score: 0, reasons: [`Excluida por: ${excluded.join(", ")}`] };

  let score = 0;
  const reasons: string[] = [];
  const keywordMatches = profile.keywords.filter((keyword) => haystack.includes(normalize(keyword)));
  if (keywordMatches.length) {
    score += Math.min(45, keywordMatches.length * 9);
    reasons.push(`Coincide: ${keywordMatches.slice(0, 5).join(", ")}`);
  }

  const category = (row.codigo_principal_de_categoria ?? "").replace(/\D/g, "");
  const unspscMatch = profile.unspsc_codes.find((code) => category.startsWith(code.replace(/\D/g, "")));
  if (unspscMatch) { score += 25; reasons.push(`UNSPSC ${row.codigo_principal_de_categoria}`); }
  if (!keywordMatches.length && !unspscMatch) return { score: 0, reasons: [] };

  if (!profile.departments.length || profile.departments.some((department) => normalize(department) === normalize(row.departamento_entidad ?? ""))) {
    score += 10;
    reasons.push(profile.departments.length ? `Cobertura: ${row.departamento_entidad}` : "Cobertura nacional");
  }

  const price = Number(row.precio_base ?? 0);
  const inRange = price >= Number(profile.min_value) && (!Number(profile.max_value) || price <= Number(profile.max_value));
  if (inRange) { score += 10; reasons.push(price ? "Presupuesto compatible" : "Valor por confirmar"); }

  const todayDate = new Date().toISOString().slice(0, 10);
  const closingDate = row.fecha_de_recepcion_de?.slice(0, 10);
  const days = closingDate ? Math.round((Date.parse(`${closingDate}T00:00:00Z`) - Date.parse(`${todayDate}T00:00:00Z`)) / 86400000) : 0;
  if (closingDate && days < Number(profile.minimum_days)) return { score: 0, reasons: [] };
  if (days >= Number(profile.minimum_days)) { score += 10; reasons.push(`${days} días disponibles`); }
  return { score: Math.min(100, score), reasons };
}

export async function saveSecopProfile(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  const payload = {
    company_id: companyId,
    keywords: list(text(data, "keywords")),
    excluded_keywords: list(text(data, "excluded_keywords")),
    unspsc_codes: list(text(data, "unspsc_codes")),
    departments: list(text(data, "departments")),
    min_value: numeric(text(data, "min_value")),
    max_value: numeric(text(data, "max_value")),
    minimum_days: numeric(text(data, "minimum_days")) || 3,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  await dbUpsert("secop_profiles", payload, "company_id");
  revalidatePath("/tenders/secop");
}

export async function syncSecop(data: FormData) {
  const companyId = required(data, "company_id", "La empresa");
  let [profile] = await dbSelect<SecopProfile>("secop_profiles", {
    select: "id,company_id,keywords,excluded_keywords,unspsc_codes,departments,min_value,max_value,minimum_days",
    company_id: `eq.${companyId}`,
  });
  if (!profile) {
    [profile] = await dbUpsert<SecopProfile>("secop_profiles", { company_id: companyId, ...defaultSecopProfile }, "company_id");
  }

  const minimumSubmission = new Date();
  minimumSubmission.setUTCDate(minimumSubmission.getUTCDate() + Number(profile.minimum_days));
  const minimumSubmissionDate = minimumSubmission.toISOString().slice(0, 10);
  const query = new URLSearchParams({
    "$select": "id_del_proceso,referencia_del_proceso,nombre_del_procedimiento,descripci_n_del_procedimiento,entidad,departamento_entidad,ciudad_entidad,fase,precio_base,modalidad_de_contratacion,fecha_de_publicacion_del,fecha_de_recepcion_de,estado_del_procedimiento,codigo_principal_de_categoria,categorias_adicionales,urlproceso",
    "$where": `fecha_de_recepcion_de >= '${minimumSubmissionDate}T00:00:00.000' AND estado_del_procedimiento = 'Publicado'`,
    "$order": "fecha_de_recepcion_de ASC",
    "$limit": "300",
  });
  const secopUrl = `https://www.datos.gov.co/resource/p6dx-8zbt.json?${query}`;
  const requestOptions = {
    headers: {
      Accept: "application/json",
      ...(process.env.SOCRATA_APP_TOKEN ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN } : {}),
    },
    cache: "no-store" as const,
  };
  let response: Response;
  try {
    response = await fetch(secopUrl, requestOptions);
  } catch {
    response = await fetch(secopUrl, requestOptions);
  }
  if (!response.ok) throw new Error(`SECOP II no respondió correctamente (${response.status}).`);
  const rows = await response.json() as SecopRow[];
  const matched = rows.flatMap((row) => {
    if (!row.id_del_proceso || !row.nombre_del_procedimiento) return [];
    const result = scoreRow(row, profile);
    if (result.score < 20) return [];
    return [{
      company_id: companyId,
      secop_process_id: row.id_del_proceso,
      reference: row.referencia_del_proceso ?? null,
      title: row.nombre_del_procedimiento,
      description: row.descripci_n_del_procedimiento ?? null,
      entity: row.entidad ?? null,
      department: row.departamento_entidad ?? null,
      city: row.ciudad_entidad ?? null,
      phase: row.fase ?? null,
      process_status: row.estado_del_procedimiento ?? null,
      modality: row.modalidad_de_contratacion ?? null,
      base_price: Number(row.precio_base ?? 0),
      publication_date: row.fecha_de_publicacion_del ?? null,
      submission_date: row.fecha_de_recepcion_de ?? null,
      unspsc_code: row.codigo_principal_de_categoria ?? null,
      additional_categories: row.categorias_adicionales ?? null,
      source_url: row.urlproceso?.url ?? null,
      match_score: result.score,
      match_reasons: result.reasons,
      synced_at: new Date().toISOString(),
    }];
  });
  const deduplicated = [...new Map(matched.map((item) => [item.secop_process_id, item])).values()];
  if (deduplicated.length) await dbUpsert("secop_opportunities", deduplicated, "company_id,secop_process_id");
  await dbUpdate("secop_profiles", { company_id: `eq.${companyId}` }, { last_synced_at: new Date().toISOString() });
  revalidatePath("/tenders/secop");
}

export async function setSecopDecision(data: FormData) {
  const id = required(data, "secop_opportunity_id", "La oportunidad");
  const decision = required(data, "decision", "La decisión");
  if (!["NEW", "REVIEW", "DISMISSED"].includes(decision)) throw new Error("Decisión inválida.");
  await dbUpdate("secop_opportunities", { id: `eq.${id}` }, { decision });
  revalidatePath("/tenders/secop");
}

type RadarOpportunity = {
  id: string; company_id: string; secop_process_id: string; reference: string | null;
  title: string; description: string | null; entity: string | null; submission_date: string | null;
  base_price: number; source_url: string | null; match_score: number; tender_id: string | null;
};

export async function importSecopTender(data: FormData) {
  const radarId = required(data, "secop_opportunity_id", "La oportunidad");
  const [opportunity] = await dbSelect<RadarOpportunity>("secop_opportunities", {
    select: "id,company_id,secop_process_id,reference,title,description,entity,submission_date,base_price,source_url,match_score,tender_id",
    id: `eq.${radarId}`,
  });
  if (!opportunity) throw new Error("La oportunidad SECOP no existe.");
  if (opportunity.tender_id) {
    await dbUpdate("secop_opportunities", { id: `eq.${radarId}` }, { decision: "IMPORTED" });
    revalidatePath("/tenders/secop");
    return;
  }
  const tender = await dbInsert<{ id: string }>("tenders", {
    company_id: opportunity.company_id,
    code: opportunity.reference || opportunity.secop_process_id,
    title: opportunity.title,
    entity: opportunity.entity,
    status: "PREPARATION",
    submission_date: opportunity.submission_date?.slice(0, 10) ?? null,
    estimated_value: Number(opportunity.base_price),
    description: opportunity.description,
    source: "SECOP_II",
    external_id: opportunity.secop_process_id,
    source_url: opportunity.source_url,
    match_score: opportunity.match_score,
  });
  await dbUpdate("secop_opportunities", { id: `eq.${radarId}` }, { decision: "IMPORTED", tender_id: tender.id });
  revalidatePath("/tenders");
  revalidatePath("/tenders/secop");
}
