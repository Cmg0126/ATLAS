import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { CurrencyInput } from "@/components/currency-input";
import { Empty, Field, input, Metric, PageTitle, primary, Section } from "../../domain-ui";
import { createRupExperience, deleteRupExperience } from "./actions";
import { RupForm } from "./rup-form";

type Company = { id: string; name: string };
type Rup = {
  issue_date: string | null; valid_until: string | null; fiscal_year: number | null;
  current_assets: number; current_liabilities: number; total_assets: number; total_liabilities: number;
  equity: number; operating_profit: number; interest_expense: number; net_income: number;
  residual_capacity: number; is_mipyme: boolean; domicile: string | null; notes: string | null;
};
type Experience = {
  id: string; contract_number: string | null; client: string; contract_object: string;
  completion_date: string | null; value_cop: number; value_smmlv: number; unspsc_codes: string[];
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const ratio = (numerator: number, denominator: number) => Number(denominator) > 0 ? Number(numerator) / Number(denominator) : null;
const showRatio = (value: number | null) => value === null ? "Pendiente" : value.toFixed(2);

export default async function ProcurementProfilePage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const filters = await searchParams;
  const companies = await dbSelect<Company>("companies", { select: "id,name", order: "name.asc" });
  const companyId = filters.company && companies.some((company) => company.id === filters.company) ? filters.company : companies[0]?.id;
  const [[rup], experiences] = companyId ? await Promise.all([
    dbSelect<Rup>("rup_profiles", {
      select: "issue_date,valid_until,fiscal_year,current_assets,current_liabilities,total_assets,total_liabilities,equity,operating_profit,interest_expense,net_income,residual_capacity,is_mipyme,domicile,notes",
      company_id: `eq.${companyId}`,
    }),
    dbSelect<Experience>("rup_experiences", {
      select: "id,contract_number,client,contract_object,completion_date,value_cop,value_smmlv,unspsc_codes",
      company_id: `eq.${companyId}`, order: "completion_date.desc",
    }),
  ]) : [[undefined], []];
  const values: Rup = rup ?? {
    issue_date: null, valid_until: null, fiscal_year: null, current_assets: 0, current_liabilities: 0,
    total_assets: 0, total_liabilities: 0, equity: 0, operating_profit: 0, interest_expense: 0,
    net_income: 0, residual_capacity: 0, is_mipyme: false, domicile: null, notes: null,
  };
  const liquidity = ratio(values.current_assets, values.current_liabilities);
  const indebtedness = ratio(values.total_liabilities, values.total_assets);
  const interestCoverage = ratio(values.operating_profit, values.interest_expense);
  const roe = ratio(values.net_income, values.equity);
  const roa = ratio(values.net_income, values.total_assets);
  const experienceSmmlv = experiences.reduce((sum, item) => sum + Number(item.value_smmlv), 0);

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageTitle domain="Contratación" title="Perfil de contratación y RUP" description="Capacidad financiera, organizacional y experiencia acreditada de la empresa." />
      <div className="flex gap-3"><Link href="/tenders/secop" className={primary}>Radar SECOP</Link><Link href="/tenders" className="rounded-xl border px-4 py-3 font-semibold">Licitaciones</Link></div>
    </div>

    {!companyId ? <div className="mt-7 rounded-xl border p-6">Primero debes configurar una empresa.</div> : <>
      <form method="get" className="mt-7 flex max-w-xl items-end gap-3 rounded-2xl border bg-white p-5">
        <Field label="Empresa"><select name="company" defaultValue={companyId} className={input}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <button className="rounded-xl border px-4 py-3 font-semibold">Cambiar</button>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Liquidez" value={showRatio(liquidity)} />
        <Metric label="Endeudamiento" value={showRatio(indebtedness)} />
        <Metric label="Cobertura intereses" value={showRatio(interestCoverage)} />
        <Metric label="Rentabilidad patrimonio" value={showRatio(roe)} />
        <Metric label="Rentabilidad activo" value={showRatio(roa)} />
        <Metric label="Experiencia" value={`${experienceSmmlv.toFixed(2)} SMMLV`} />
      </div>

      <Section title="Información financiera del RUP">
        <p className="mt-2 text-sm text-zinc-500">Carga el certificado para completar los campos automáticamente o modifícalos manualmente antes de guardar.</p>
        <RupForm companyId={companyId} values={values} />
      </Section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <Section title="Registrar experiencia">
          <form action={createRupExperience} className="mt-4 space-y-4">
            <input type="hidden" name="company_id" value={companyId} />
            <Field label="Contrato"><input name="contract_number" className={input} /></Field>
            <Field label="Entidad contratante"><input required name="client" className={input} /></Field>
            <Field label="Objeto contractual"><textarea required name="contract_object" rows={4} className={input} /></Field>
            <Field label="Fecha de terminación"><input type="date" name="completion_date" className={input} /></Field>
            <Field label="Valor en pesos"><CurrencyInput name="value_cop" className={input} required /></Field>
            <Field label="Valor acreditado en SMMLV"><input type="number" min="0" step="any" name="value_smmlv" className={input} /></Field>
            <Field label="Códigos UNSPSC"><textarea name="unspsc_codes" rows={3} className={input} placeholder="43223300&#10;72151500" /></Field>
            <button className={`${primary} w-full`}>Agregar experiencia</button>
          </form>
        </Section>
        <Section title={`Experiencia acreditada (${experiences.length})`}>
          <div className="mt-3 divide-y">{experiences.map((experience) => <div key={experience.id} className="py-4">
            <div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{experience.contract_number || "Sin número"} · {experience.client}</p><p className="mt-1 text-sm">{experience.contract_object}</p><p className="mt-1 text-xs text-zinc-500">{experience.completion_date || "Sin fecha"} · {experience.unspsc_codes.join(", ") || "Sin UNSPSC"}</p></div><div className="text-right"><p className="font-bold">{Number(experience.value_smmlv).toFixed(2)} SMMLV</p><p className="text-xs text-zinc-500">{money.format(Number(experience.value_cop))}</p><form action={deleteRupExperience} className="mt-2"><input type="hidden" name="experience_id" value={experience.id} /><button className="text-xs font-semibold text-red-500">Eliminar</button></form></div></div>
          </div>)}{!experiences.length && <Empty text="Todavía no hay contratos de experiencia registrados." />}</div>
        </Section>
      </div>
    </>}
  </AppShell>;
}
