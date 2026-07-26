import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, Metric, PageTitle, Section } from "../domain-ui";
import { createApu } from "./actions";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });

export default async function ApuPage() {
  const [companies, apus] = await Promise.all([
    dbSelect<{ id: string; name: string }>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<{ id: string; code: string; name: string; unit: string; status: string; version: number; direct_cost: number; unit_price: number }>("apu_templates", {
      select: "id,code,name,unit,status,version,direct_cost,unit_price", order: "updated_at.desc",
    }),
  ]);
  return <AppShell>
    <PageTitle domain="Presupuestos" title="Banco de APU" description="Análisis de precios unitarios reutilizables para cotizaciones y proyectos." />
    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <Metric label="APU registrados" value={String(apus.length)} />
      <Metric label="APU activos" value={String(apus.filter((apu) => apu.status === "ACTIVE").length)} />
      <Metric label="Borradores" value={String(apus.filter((apu) => apu.status === "DRAFT").length)} />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[420px_1fr]">
      <Section title="Crear APU"><form action={createApu} className="mt-5 space-y-4">
        <Field label="Empresa"><select required name="company_id" className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <Field label="Código"><input required name="code" className={input} placeholder="APU-CCTV-001" /></Field>
        <Field label="Nombre"><input required name="name" className={input} /></Field>
        <Field label="Descripción"><textarea name="description" rows={2} className={input} /></Field>
        <Field label="Unidad"><input name="unit" defaultValue="UND" className={input} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Administración %"><input name="administration_percent" type="number" step="0.01" defaultValue="0" className={input} /></Field>
          <Field label="Imprevistos %"><input name="contingency_percent" type="number" step="0.01" defaultValue="0" className={input} /></Field>
          <Field label="Utilidad %"><input name="profit_percent" type="number" step="0.01" defaultValue="0" className={input} /></Field>
          <Field label="IVA utilidad %"><input name="tax_on_profit_percent" type="number" step="0.01" defaultValue="19" className={input} /></Field>
        </div>
        <button className="w-full rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Crear y editar APU</button>
      </form></Section>
      <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-zinc-900 text-zinc-300"><tr><th className="p-4">APU</th><th>Estado</th><th>Costo directo</th><th>Precio unitario</th><th></th></tr></thead>
          <tbody className="divide-y divide-zinc-800">{apus.map((apu) => <tr key={apu.id}>
            <td className="p-4"><strong>{apu.code} · V{apu.version}</strong><p className="text-zinc-400">{apu.name} / {apu.unit}</p></td>
            <td>{apu.status}</td><td>{money.format(Number(apu.direct_cost))}</td><td className="font-bold text-yellow-400">{money.format(Number(apu.unit_price))}</td>
            <td><Link href={`/apu/${apu.id}`} className="text-yellow-400">Abrir</Link></td>
          </tr>)}</tbody>
        </table>
        {!apus.length && <p className="p-10 text-center text-zinc-500">Crea el primer análisis de precio unitario.</p>}
      </section>
    </div>
  </AppShell>;
}
