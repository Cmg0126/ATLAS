import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createTender, createTenderRequirement, updateTender } from "../domain-actions";
import { Empty, Field, input, Metric, PageTitle, primary, Section } from "../domain-ui";

type Tender={id:string;code:string;title:string;entity:string|null;status:string;submission_date:string|null;estimated_value:number;clients:{name:string}|null};
type Requirement={id:string;tender_id:string;title:string;responsible:string|null;due_date:string|null;status:string};
const money=new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
export default async function TendersPage(){
 const [companies,clients,tenders,requirements]=await Promise.all([
  dbSelect<{id:string;name:string}>("companies",{select:"id,name",order:"name.asc"}),
  dbSelect<{id:string;name:string}>("clients",{select:"id,name",status:"eq.ACTIVE",order:"name.asc"}),
  dbSelect<Tender>("tenders",{select:"id,code,title,entity,status,submission_date,estimated_value,clients(name)",order:"created_at.desc"}),
  dbSelect<Requirement>("tender_requirements",{select:"id,tender_id,title,responsible,due_date,status",order:"created_at.desc"})
 ]);
 const open=tenders.filter(t=>!["WON","LOST","CANCELLED"].includes(t.status));
 return <AppShell><PageTitle domain="Contratación" title="Licitaciones" description="Registro, fechas críticas y control de requisitos."/>
  <div className="mt-7 grid gap-4 md:grid-cols-3"><Metric label="Abiertas" value={String(open.length)}/><Metric label="Valor en proceso" value={money.format(open.reduce((s,t)=>s+Number(t.estimated_value||0),0))}/><Metric label="Requisitos pendientes" value={String(requirements.filter(r=>r.status!=="DONE").length)}/></div>
  <div className="mt-7 grid gap-6 xl:grid-cols-2"><Section title="Nueva licitación"><form action={createTender} className="mt-5 grid gap-4 md:grid-cols-2">
   <Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Cliente"><select name="client_id" className={input}><option value="">Sin cliente</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Código"><input name="code" required className={input}/></Field><Field label="Título"><input name="title" required className={input}/></Field>
   <Field label="Entidad"><input name="entity" className={input}/></Field><Field label="Entrega"><input type="date" name="submission_date" className={input}/></Field>
   <Field label="Valor estimado"><input type="number" min="0" name="estimated_value" className={input}/></Field><Field label="Estado"><select name="status" className={input}><option value="DRAFT">Borrador</option><option value="PREPARATION">Preparación</option><option value="SUBMITTED">Presentada</option></select></Field>
   <button className={`${primary} md:col-span-2`}>Crear licitación</button>
  </form></Section>
  <Section title="Nuevo requisito"><form action={createTenderRequirement} className="mt-5 grid gap-4 md:grid-cols-2">
   <Field label="Licitación"><select name="tender_id" required className={input}><option value="">Seleccionar</option>{tenders.map(x=><option key={x.id} value={x.id}>{x.code} · {x.title}</option>)}</select></Field>
   <Field label="Requisito"><input name="title" required className={input}/></Field><Field label="Responsable"><input name="responsible" className={input}/></Field><Field label="Fecha límite"><input type="date" name="due_date" className={input}/></Field>
   <button className={`${primary} md:col-span-2`}>Agregar requisito</button>
  </form></Section></div>
  <div className="mt-7 space-y-4">{tenders.map(t=><section key={t.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-orange-600">{t.code}</p><h2 className="text-lg font-bold">{t.title}</h2><p className="text-sm text-zinc-500">{t.entity||t.clients?.name||"Sin entidad"} · {t.submission_date||"Sin fecha"} · {money.format(Number(t.estimated_value||0))}</p></div><form action={updateTender} className="flex gap-2"><input type="hidden" name="tender_id" value={t.id}/><select name="status" defaultValue={t.status} className="rounded-xl border px-3"><option value="DRAFT">Borrador</option><option value="PREPARATION">Preparación</option><option value="SUBMITTED">Presentada</option><option value="WON">Ganada</option><option value="LOST">Perdida</option><option value="CANCELLED">Cancelada</option></select><button className="rounded-xl bg-zinc-950 px-4 text-white">Guardar</button></form></div><div className="mt-4 grid gap-2 md:grid-cols-2">{requirements.filter(r=>r.tender_id===t.id).map(r=><div key={r.id} className="rounded-xl bg-zinc-50 p-3"><p className="font-semibold">{r.title}</p><p className="text-xs text-zinc-500">{r.responsible||"Sin responsable"} · {r.due_date||"Sin fecha"} · {r.status}</p></div>)}</div></section>)}{!tenders.length&&<Empty text="No hay licitaciones registradas."/>}</div>
 </AppShell>;
}
