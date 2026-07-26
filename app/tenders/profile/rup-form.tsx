"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import type { ExtractedRup, ExtractedRupExperience } from "@/lib/rup-extractor";
import { CurrencyInput } from "@/components/currency-input";
import { Field, input, primary } from "../../domain-ui";
import { saveRupProfile } from "./actions";

type RupValues = {
  issue_date: string | null; valid_until: string | null; fiscal_year: number | null;
  current_assets: number; current_liabilities: number; total_assets: number; total_liabilities: number;
  equity: number; operating_profit: number; interest_expense: number; net_income: number;
  residual_capacity: number; is_mipyme: boolean; domicile: string | null; notes: string | null;
};

const initialForm = (values: RupValues): ExtractedRup => ({
  issue_date: values.issue_date ?? "", valid_until: values.valid_until ?? "",
  fiscal_year: values.fiscal_year ? String(values.fiscal_year) : "",
  current_assets: String(values.current_assets ?? 0), current_liabilities: String(values.current_liabilities ?? 0),
  total_assets: String(values.total_assets ?? 0), total_liabilities: String(values.total_liabilities ?? 0),
  equity: String(values.equity ?? 0), operating_profit: String(values.operating_profit ?? 0),
  interest_expense: String(values.interest_expense ?? 0), net_income: String(values.net_income ?? 0),
  residual_capacity: String(values.residual_capacity ?? 0), domicile: values.domicile ?? "",
  is_mipyme: values.is_mipyme, notes: values.notes ?? "",
});

export function RupForm({ companyId, values }: { companyId: string; values: RupValues }) {
  const [form, setForm] = useState(() => initialForm(values));
  const [experiences, setExperiences] = useState<ExtractedRupExperience[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const operatingProfit = Number(form.operating_profit) || 0;
  const equity = Number(form.equity) || 0;
  const totalAssets = Number(form.total_assets) || 0;
  const currentAssets = Number(form.current_assets) || 0;
  const currentLiabilities = Number(form.current_liabilities) || 0;
  const totalLiabilities = Number(form.total_liabilities) || 0;
  const liquidity = currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const indebtedness = totalAssets > 0 ? totalLiabilities / totalAssets : null;
  const roe = equity > 0 ? operatingProfit / equity : null;
  const roa = totalAssets > 0 ? operatingProfit / totalAssets : null;
  const showProfitability = (value: number | null) =>
    value === null
      ? "Pendiente"
      : `${value.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (${(value * 100).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %)`;
  const showIndex = (value: number | null) =>
    value === null ? "Pendiente" : value.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const change = (key: keyof ExtractedRup, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function extractPdf(file?: File) {
    if (!file) return;
    setExtracting(true);
    setError("");
    setStatus("");
    setFileName(file.name);
    const payload = new FormData();
    payload.set("file", file);
    payload.set("company_id", companyId);
    try {
      const response = await fetch("/api/tenders/rup/extract", { method: "POST", body: payload });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(response.status === 413
          ? "El PDF supera el límite de carga de Vercel. Usa un archivo de máximo 4 MB."
          : "Vercel no pudo procesar el PDF. Intenta nuevamente en unos segundos.");
      }
      const result = await response.json() as {
        values?: ExtractedRup; experiences?: ExtractedRupExperience[]; found?: number;
        experienceCount?: number; pages?: number; error?: string;
      };
      if (!response.ok || !result.values) throw new Error(result.error || "No fue posible procesar el PDF.");
      const extracted = result.values;
      setForm((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(extracted).filter(([key, value]) => key === "is_mipyme" || value !== "")),
      }));
      setExperiences(result.experiences ?? []);
      setStatus(`ATLAS encontró ${result.found ?? 0} campos financieros y ${result.experienceCount ?? 0} experiencias en ${result.pages ?? 0} página(s). Revisa y modifica lo necesario antes de guardar.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible procesar el PDF.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const bind = (key: keyof ExtractedRup) => ({
    value: String(form[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value),
  });

  const currency = (key: keyof ExtractedRup, allowNegative = false) => (
    <CurrencyInput
      name={key}
      value={String(form[key])}
      onValueChange={(value) => change(key, value)}
      className={input}
      allowNegative={allowNegative}
    />
  );

  return <>
    <div className="mt-5 rounded-2xl border border-dashed border-yellow-500/60 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-yellow-500 p-3 text-black"><FileText size={22} /></div>
          <div><p className="font-bold">Subir, archivar y extraer el RUP</p><p className="text-sm text-zinc-400">El PDF se guarda inmediatamente como documento base. Después puedes revisar y confirmar los datos extraídos.</p></div>
        </div>
        <label className={`${primary} cursor-pointer`}>
          <Upload className="mr-2 inline" size={17} />{extracting ? "Leyendo PDF..." : "Seleccionar PDF"}
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={extracting}
            onChange={(event) => extractPdf(event.target.files?.[0])} />
        </label>
      </div>
      {fileName && <p className="mt-3 text-sm font-semibold">{fileName}</p>}
      {status && <p role="status" className="mt-3 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">{status}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Índice de liquidez</p>
        <p className="mt-2 text-xl font-bold text-yellow-500">{showIndex(liquidity)}</p>
        <p className="mt-2 text-xs text-zinc-500">Activo corriente ÷ Pasivo corriente</p>
      </div>
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Índice de endeudamiento</p>
        <p className="mt-2 text-xl font-bold text-yellow-500">{showProfitability(indebtedness)}</p>
        <p className="mt-2 text-xs text-zinc-500">Pasivo total ÷ Activo total</p>
      </div>
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Rentabilidad del patrimonio</p>
        <p className="mt-2 text-xl font-bold text-yellow-500">{showProfitability(roe)}</p>
        <p className="mt-2 text-xs text-zinc-500">Utilidad operacional ÷ Patrimonio</p>
      </div>
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Rentabilidad del activo</p>
        <p className="mt-2 text-xl font-bold text-yellow-500">{showProfitability(roa)}</p>
        <p className="mt-2 text-xs text-zinc-500">Utilidad operacional ÷ Activo total</p>
      </div>
    </div>

    <form action={saveRupProfile} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="rup_experiences_json" value={JSON.stringify(experiences)} />
      <Field label="Fecha de expedición"><input type="date" name="issue_date" {...bind("issue_date")} className={input} /></Field>
      <Field label="Vigente hasta"><input type="date" name="valid_until" {...bind("valid_until")} className={input} /></Field>
      <Field label="Año fiscal"><input type="number" name="fiscal_year" min="2000" max="2100" {...bind("fiscal_year")} className={input} /></Field>
      <Field label="Domicilio"><input name="domicile" {...bind("domicile")} className={input} /></Field>
      <Field label="Activo corriente">{currency("current_assets")}</Field>
      <Field label="Pasivo corriente">{currency("current_liabilities")}</Field>
      <Field label="Activo total">{currency("total_assets")}</Field>
      <Field label="Pasivo total">{currency("total_liabilities")}</Field>
      <Field label="Patrimonio">{currency("equity", true)}</Field>
      <Field label="Utilidad operacional">{currency("operating_profit", true)}</Field>
      <Field label="Gastos de intereses">{currency("interest_expense")}</Field>
      <Field label="Utilidad neta">{currency("net_income", true)}</Field>
      <Field label="Capacidad residual">{currency("residual_capacity")}</Field>
      <label className="flex items-center gap-3 rounded-xl border px-4 py-3"><input type="checkbox" name="is_mipyme"
        checked={form.is_mipyme} onChange={(event) => change("is_mipyme", event.target.checked)} /> Empresa Mipyme</label>
      <div className="md:col-span-2"><Field label="Notas"><textarea name="notes" rows={3} {...bind("notes")} className={input} /></Field></div>
      {experiences.length > 0 && (
        <section className="space-y-3 md:col-span-2 xl:col-span-4">
          <div>
            <h3 className="text-lg font-bold">Experiencia acreditada extraída del RUP</h3>
            <p className="text-sm text-zinc-500">El certificado no contiene objeto, fecha de terminación ni valor original en pesos. Puedes completarlos después.</p>
          </div>
          {experiences.map((experience, index) => (
            <article key={`${experience.contract_number}-${index}`} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Consecutivo">
                <input value={experience.contract_number} onChange={(event) => setExperiences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, contract_number: event.target.value } : item))} className={input} />
              </Field>
              <Field label="Contratante">
                <input value={experience.client} onChange={(event) => setExperiences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, client: event.target.value } : item))} className={input} />
              </Field>
              <Field label="Valor acreditado en SMMLV">
                <input type="number" step="0.01" value={experience.value_smmlv} onChange={(event) => setExperiences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value_smmlv: event.target.value } : item))} className={input} />
              </Field>
              <Field label="Códigos UNSPSC">
                <input value={experience.unspsc_codes.join(", ")} onChange={(event) => setExperiences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unspsc_codes: event.target.value.split(",").map((code) => code.trim()).filter(Boolean) } : item))} className={input} />
              </Field>
            </article>
          ))}
        </section>
      )}
      <button className={`${primary} md:col-span-2 xl:col-span-4`}>Guardar datos RUP revisados y actualizar SECOP</button>
    </form>
  </>;
}
