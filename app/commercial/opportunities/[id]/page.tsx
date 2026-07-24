import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { convertQuotationToProject, createQuotation, updateOpportunity, updateQuotationStatus } from "../../actions";
import { Empty, Field, input } from "../../ui";

type Opportunity = { id: string; title: string; stage: string; estimated_value: number; probability: number; expected_close_date: string | null; client_id: string; clients: { name: string } | null };
type Quotation = { id: string; quotation_number: string | null; status: string; total: number };
type Company = { id: string; name: string };
type Branch = { id: string; company_id: string; name: string };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity] = await dbSelect<Opportunity>("opportunities", { select: "id,title,stage,estimated_value,probability,expected_close_date,client_id,clients(name)", id: `eq.${id}` });
  if (!opportunity) notFound();
  const [quotations, companies, branches] = await Promise.all([
    dbSelect<Quotation>("quotations", { select: "id,quotation_number,status,total", opportunity_id: `eq.${id}`, order: "created_at.desc" }),
    dbSelect<Company>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<Branch>("branches", { select: "id,company_id,name", order: "name.asc" }),
  ]);
  return <AppShell>
    <div><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><p className="mt-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">{opportunity.clients?.name}</p><h1 className="mt-1 text-3xl font-bold">{opportunity.title}</h1></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Seguimiento</h2><form action={updateOpportunity} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="opportunity_id" value={id} /><Field label="Etapa"><select name="stage" defaultValue={opportunity.stage} className={input}><option value="PROSPECT">Prospecto</option><option value="QUALIFIED">Calificada</option><option value="PROPOSAL">Propuesta</option><option value="NEGOTIATION">Negociación</option><option value="WON">Ganada</option><option value="LOST">Perdida</option></select></Field><Field label="Probabilidad %"><input type="number" name="probability" min="0" max="100" defaultValue={opportunity.probability} className={input} /></Field><Field label="Valor estimado"><input type="number" name="estimated_value" min="0" defaultValue={opportunity.estimated_value} className={input} /></Field><Field label="Cierre esperado"><input type="date" name="expected_close_date" defaultValue={opportunity.expected_close_date || ""} className={input} /></Field><button className="rounded-xl bg-zinc-950 px-5 py-3 font-semibold text-white md:col-span-2">Actualizar oportunidad</button></form></section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Nueva cotización</h2><form action={createQuotation} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="opportunity_id" value={id} /><Field label="Número"><input name="quotation_number" required className={input} placeholder="COT-2026-001" /></Field><Field label="Total"><input type="number" name="total" min="0" required className={input} /></Field><Field label="Estado"><select name="status" className={input}><option value="DRAFT">Borrador</option><option value="SENT">Enviada</option><option value="APPROVED">Aprobada</option><option value="REJECTED">Rechazada</option></select></Field><div className="flex items-end"><button className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Crear cotización</button></div></form></section>
    </div>
    <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Cotizaciones ({quotations.length})</h2><div className="mt-4 space-y-5">
      {quotations.map((quotation) => <div key={quotation.id} className="rounded-xl border p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold">{quotation.quotation_number || "Sin número"}</p><p className="text-lg">{money.format(Number(quotation.total || 0))}</p></div><form action={updateQuotationStatus} className="flex gap-2"><input type="hidden" name="quotation_id" value={quotation.id} /><input type="hidden" name="opportunity_id" value={id} /><select name="status" defaultValue={quotation.status} className="rounded-xl border px-3"><option value="DRAFT">Borrador</option><option value="SENT">Enviada</option><option value="APPROVED">Aprobada</option><option value="REJECTED">Rechazada</option></select><button className="rounded-xl bg-zinc-950 px-4 py-2 font-semibold text-white">Guardar</button></form></div>
        {quotation.status === "APPROVED" && <form action={convertQuotationToProject} className="mt-5 grid gap-3 rounded-xl bg-orange-50 p-4 md:grid-cols-3"><input type="hidden" name="quotation_id" value={quotation.id} /><Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field><Field label="Sede"><select name="branch_id" className={input}><option value="">Sin sede</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field><Field label="Código del proyecto"><input name="project_code" required className={input} placeholder="PR-2026-001" /></Field><Field label="Nombre"><input name="name" defaultValue={opportunity.title} className={input} /></Field><Field label="Tipo"><input name="project_type" required className={input} placeholder="CCTV, GPON..." /></Field><Field label="Prioridad"><select name="priority" className={input}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></Field><Field label="Costo presupuestado"><input type="number" name="budget_cost" min="0" className={input} /></Field><Field label="Ubicación"><input name="location" className={input} /></Field><div className="flex items-end"><button className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Convertir en proyecto</button></div></form>}
      </div>)}{!quotations.length && <Empty>No hay cotizaciones para esta oportunidad.</Empty>}
    </div></section>
  </AppShell>;
}
