import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Empty, Field, input, Metric, PageTitle, primary, Section } from "../../domain-ui";
import { importSecopTender, saveSecopProfile, setSecopDecision, syncSecop } from "./actions";
import { defaultSecopProfile } from "./profile";
import { evaluateSecopRequirements } from "../profile/actions";

type Company = { id: string; name: string };
type Profile = {
  company_id: string; keywords: string[]; excluded_keywords: string[]; unspsc_codes: string[];
  required_keywords: string[]; sectors: string[]; departments: string[]; municipalities: string[];
  modalities: string[]; preferred_entities: string[]; excluded_entities: string[];
  min_value: number; max_value: number; minimum_days: number; last_synced_at: string | null;
};
type Opportunity = {
  id: string; reference: string | null; title: string; description: string | null; entity: string | null;
  department: string | null; city: string | null; modality: string | null; base_price: number;
  submission_date: string | null; unspsc_code: string | null; source_url: string | null;
  match_score: number; match_reasons: string[]; decision: string; tender_id: string | null;
  required_liquidity: number | null; max_indebtedness: number | null; min_interest_coverage: number | null;
  min_roe: number | null; min_roa: number | null; required_experience_smmlv: number | null;
  required_experience_unspsc: string[]; eligibility_status: string; eligibility_score: number | null;
  eligibility_reasons: string[];
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default async function SecopRadarPage({ searchParams }: { searchParams: Promise<{ company?: string; decision?: string }> }) {
  const filters = await searchParams;
  const companies = await dbSelect<Company>("companies", { select: "id,name", order: "name.asc" });
  const companyId = filters.company && companies.some((company) => company.id === filters.company) ? filters.company : companies[0]?.id;
  const [storedProfile] = companyId ? await dbSelect<Profile>("secop_profiles", {
    select: "company_id,keywords,excluded_keywords,required_keywords,sectors,unspsc_codes,departments,municipalities,modalities,preferred_entities,excluded_entities,min_value,max_value,minimum_days,last_synced_at",
    company_id: `eq.${companyId}`,
  }) : [];
  const profile = storedProfile ?? { company_id: companyId ?? "", last_synced_at: null, ...defaultSecopProfile };
  const decision = ["NEW", "REVIEW", "DISMISSED", "IMPORTED"].includes(filters.decision ?? "") ? filters.decision! : "";
  const opportunities = companyId ? await dbSelect<Opportunity>("secop_opportunities", {
    select: "id,reference,title,description,entity,department,city,modality,base_price,submission_date,unspsc_code,source_url,match_score,match_reasons,decision,tender_id,required_liquidity,max_indebtedness,min_interest_coverage,min_roe,min_roa,required_experience_smmlv,required_experience_unspsc,eligibility_status,eligibility_score,eligibility_reasons",
    company_id: `eq.${companyId}`,
    ...(decision ? { decision: `eq.${decision}` } : { decision: "neq.DISMISSED" }),
    order: "match_score.desc,submission_date.asc",
    limit: 250,
  }) : [];

  const newCount = opportunities.filter((item) => item.decision === "NEW").length;
  const reviewCount = opportunities.filter((item) => item.decision === "REVIEW").length;
  const importedCount = opportunities.filter((item) => item.decision === "IMPORTED").length;

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-5">
      <PageTitle domain="Inteligencia comercial" title="Radar SECOP II" description="Procesos públicos clasificados automáticamente según el perfil de ITLATAM." />
      <div className="flex gap-3"><Link href="/tenders/profile" className="rounded-xl border px-4 py-3 font-semibold">Perfil y RUP</Link><Link href="/tenders" className="rounded-xl border px-4 py-3 font-semibold">Licitaciones</Link>{companyId && <form action={syncSecop}><input type="hidden" name="company_id" value={companyId} /><button className={primary}>Sincronizar ahora</button></form>}</div>
    </div>

    {!companies.length ? <div className="mt-7 rounded-xl border p-6">Primero debes configurar una empresa.</div> : <>
      <div className="mt-7 flex flex-wrap items-end gap-4 rounded-2xl border bg-white p-5">
        <form method="get" className="flex items-end gap-3"><Field label="Empresa"><select name="company" defaultValue={companyId} className={input}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field><button className="rounded-xl border px-4 py-3 font-semibold">Cambiar</button></form>
        <p className="ml-auto text-sm text-zinc-500">Última sincronización: {profile.last_synced_at ? new Date(profile.last_synced_at).toLocaleString("es-CO") : "Pendiente"}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4"><Metric label="Nuevas" value={String(newCount)} /><Metric label="En revisión" value={String(reviewCount)} /><Metric label="Importadas" value={String(importedCount)} /><Metric label="Mejor coincidencia" value={`${opportunities[0]?.match_score ?? 0}%`} /></div>

      <details className="mt-6 rounded-2xl border bg-white p-6">
        <summary className="cursor-pointer text-lg font-bold">Configurar perfil de búsqueda</summary>
        <form action={saveSecopProfile} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="company_id" value={companyId} />
          <Field label="Sectores"><textarea name="sectors" rows={5} defaultValue={profile.sectors.join("\n")} className={input} /></Field>
          <Field label="Palabras clave"><textarea name="keywords" rows={7} defaultValue={profile.keywords.join("\n")} className={input} /></Field>
          <Field label="Palabras obligatorias (deben aparecer todas)"><textarea name="required_keywords" rows={4} defaultValue={profile.required_keywords.join("\n")} className={input} /></Field>
          <Field label="Excluir procesos que contengan"><textarea name="excluded_keywords" rows={7} defaultValue={profile.excluded_keywords.join("\n")} className={input} /></Field>
          <Field label="Códigos o familias UNSPSC"><textarea name="unspsc_codes" rows={4} defaultValue={profile.unspsc_codes.join("\n")} className={input} /></Field>
          <Field label="Departamentos (vacío = nacional)"><textarea name="departments" rows={4} defaultValue={profile.departments.join("\n")} className={input} placeholder="Bolívar&#10;Atlántico" /></Field>
          <Field label="Municipios específicos"><textarea name="municipalities" rows={4} defaultValue={profile.municipalities.join("\n")} className={input} /></Field>
          <Field label="Modalidades aceptadas"><textarea name="modalities" rows={4} defaultValue={profile.modalities.join("\n")} className={input} placeholder="Licitación pública&#10;Mínima cuantía" /></Field>
          <Field label="Entidades preferidas"><textarea name="preferred_entities" rows={4} defaultValue={profile.preferred_entities.join("\n")} className={input} /></Field>
          <Field label="Entidades excluidas"><textarea name="excluded_entities" rows={4} defaultValue={profile.excluded_entities.join("\n")} className={input} /></Field>
          <Field label="Valor mínimo"><input type="number" min="0" name="min_value" defaultValue={profile.min_value} className={input} /></Field>
          <Field label="Valor máximo (0 = sin límite)"><input type="number" min="0" name="max_value" defaultValue={profile.max_value} className={input} /></Field>
          <Field label="Días mínimos para presentar"><input type="number" min="0" name="minimum_days" defaultValue={profile.minimum_days} className={input} /></Field>
          <div className="flex items-end"><button className={`${primary} w-full`}>Guardar perfil</button></div>
        </form>
      </details>

      <div className="mt-6 flex flex-wrap gap-2">
        {[["", "Activas"], ["NEW", "Nuevas"], ["REVIEW", "En revisión"], ["IMPORTED", "Importadas"], ["DISMISSED", "Descartadas"]].map(([value, label]) => <Link key={label} href={`/tenders/secop?company=${companyId}${value ? `&decision=${value}` : ""}`} className={`rounded-full border px-4 py-2 text-sm font-semibold ${decision === value ? "bg-orange-500 text-white" : "bg-white"}`}>{label}</Link>)}
      </div>

      <div className="mt-5 space-y-4">
        {opportunities.map((opportunity) => <article key={opportunity.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-4xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">{opportunity.match_score}% afinidad</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${opportunity.eligibility_status === "ELIGIBLE" ? "bg-green-700" : opportunity.eligibility_status === "NOT_ELIGIBLE" ? "bg-red-700" : "bg-amber-600"}`}>{opportunity.eligibility_status === "ELIGIBLE" ? "Cumple RUP" : opportunity.eligibility_status === "NOT_ELIGIBLE" ? "No cumple RUP" : "RUP por revisar"}{opportunity.eligibility_score !== null ? ` · ${opportunity.eligibility_score}%` : ""}</span><span className="text-xs font-bold uppercase text-zinc-500">{opportunity.reference || "Sin referencia"}</span><span className="text-xs">{opportunity.decision}</span></div><h2 className="mt-3 text-xl font-bold">{opportunity.title}</h2><p className="mt-1 text-sm text-zinc-500">{opportunity.entity} · {opportunity.department}{opportunity.city ? ` / ${opportunity.city}` : ""}</p><p className="mt-3 line-clamp-3 text-sm">{opportunity.description}</p></div>
            <div className="text-right"><p className="text-lg font-bold">{money.format(Number(opportunity.base_price || 0))}</p><p className="text-sm text-zinc-500">Cierre: {opportunity.submission_date?.slice(0, 10) || "Por confirmar"}</p><p className="text-xs text-zinc-500">{opportunity.modality}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{opportunity.match_reasons.map((reason) => <span key={reason} className="rounded-full bg-zinc-900 px-3 py-1 text-xs">{reason}</span>)}{opportunity.unspsc_code && <span className="rounded-full border px-3 py-1 text-xs">{opportunity.unspsc_code}</span>}</div>
          {opportunity.eligibility_reasons.length > 0 && <div className="mt-4 rounded-xl border p-4 text-sm"><p className="font-bold">Evaluación RUP</p>{opportunity.eligibility_reasons.map((reason) => <p key={reason} className="mt-1">{reason}</p>)}</div>}
          <details className="mt-4 rounded-xl border p-4">
            <summary className="cursor-pointer font-bold">Ingresar requisitos del pliego y evaluar</summary>
            <form action={evaluateSecopRequirements} className="mt-4 grid gap-3 md:grid-cols-3">
              <input type="hidden" name="secop_opportunity_id" value={opportunity.id} /><input type="hidden" name="company_id" value={companyId} />
              <Field label="Liquidez mínima"><input type="number" step="any" name="required_liquidity" defaultValue={opportunity.required_liquidity ?? ""} className={input} /></Field>
              <Field label="Endeudamiento máximo (ej. 0.65)"><input type="number" step="any" name="max_indebtedness" defaultValue={opportunity.max_indebtedness ?? ""} className={input} /></Field>
              <Field label="Cobertura de intereses mínima"><input type="number" step="any" name="min_interest_coverage" defaultValue={opportunity.min_interest_coverage ?? ""} className={input} /></Field>
              <Field label="Rentabilidad patrimonio mínima"><input type="number" step="any" name="min_roe" defaultValue={opportunity.min_roe ?? ""} className={input} /></Field>
              <Field label="Rentabilidad activo mínima"><input type="number" step="any" name="min_roa" defaultValue={opportunity.min_roa ?? ""} className={input} /></Field>
              <Field label="Experiencia mínima (SMMLV)"><input type="number" step="any" name="required_experience_smmlv" defaultValue={opportunity.required_experience_smmlv ?? ""} className={input} /></Field>
              <div className="md:col-span-2"><Field label="UNSPSC exigidos para experiencia"><textarea name="required_experience_unspsc" rows={2} defaultValue={opportunity.required_experience_unspsc.join("\n")} className={input} /></Field></div>
              <div className="flex items-end"><button className={`${primary} w-full`}>Evaluar capacidad</button></div>
            </form>
          </details>
          <div className="mt-5 flex flex-wrap gap-2">
            {opportunity.source_url && <a href={opportunity.source_url} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-semibold">Ver en SECOP II</a>}
            {opportunity.decision !== "IMPORTED" && <><form action={setSecopDecision}><input type="hidden" name="secop_opportunity_id" value={opportunity.id} /><input type="hidden" name="decision" value="REVIEW" /><button className="rounded-xl border px-4 py-2 font-semibold">Revisar</button></form><form action={setSecopDecision}><input type="hidden" name="secop_opportunity_id" value={opportunity.id} /><input type="hidden" name="decision" value="DISMISSED" /><button className="rounded-xl border px-4 py-2 font-semibold text-red-500">Descartar</button></form><form action={importSecopTender}><input type="hidden" name="secop_opportunity_id" value={opportunity.id} /><button className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white">Importar a Licitaciones</button></form></>}
            {opportunity.tender_id && <Link href="/tenders" className="rounded-xl bg-green-700 px-4 py-2 font-semibold text-white">Abrir licitación importada</Link>}
          </div>
        </article>)}
        {!opportunities.length && <Section title="Sin resultados"><Empty text={profile.last_synced_at ? "No hay procesos para este filtro." : "Guarda el perfil y ejecuta la primera sincronización."} /></Section>}
      </div>
    </>}
  </AppShell>;
}
