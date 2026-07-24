import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createProject } from "../actions";

type Option={id:string;name?:string;full_name?:string};
const input="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-orange-500";

export default async function NewProjectPage(){
  const [companies,branches,clients,profiles]=await Promise.all([
    dbSelect<Option>("companies",{select:"id,name",order:"name.asc"}),dbSelect<Option>("branches",{select:"id,name",order:"name.asc"}),dbSelect<Option>("clients",{select:"id,name",order:"name.asc"}),dbSelect<Option>("profiles",{select:"id,full_name",is_active:"eq.true",order:"full_name.asc"})]);
  return <AppShell><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Proyectos</p><h1 className="mt-1 text-3xl font-bold">Nuevo proyecto</h1></div><Link href="/projects" className="font-semibold text-zinc-600">Volver</Link></div>
  <form action={createProject} className="mt-8 grid gap-6 rounded-2xl border bg-white p-7 shadow-sm md:grid-cols-2">
    <Field label="Código"><input name="project_code" required className={input} placeholder="ITL-2026-001"/></Field><Field label="Nombre"><input name="name" required className={input}/></Field>
    <Field label="Empresa"><Select name="company_id" options={companies} required/></Field><Field label="Sede"><Select name="branch_id" options={branches}/></Field><Field label="Cliente"><Select name="client_id" options={clients}/></Field><Field label="Director"><Select name="manager_id" options={profiles}/></Field>
    <Field label="Tipo"><input name="project_type" required className={input} placeholder="CCTV, incendio, GPON..."/></Field><Field label="Ubicación"><input name="location" className={input}/></Field>
    <Field label="Estado"><select name="status" className={input}><option value="PLANNING">Planeación</option><option value="ACTIVE">Activo</option><option value="ON_HOLD">Suspendido</option></select></Field><Field label="Prioridad"><select name="priority" className={input}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></Field>
    <Field label="Inicio"><input type="date" name="start_date" className={input}/></Field><Field label="Fin planeado"><input type="date" name="planned_end_date" className={input}/></Field><Field label="Valor contrato"><input type="number" min="0" name="contract_value" className={input}/></Field><Field label="Costo presupuestado"><input type="number" min="0" name="budget_cost" className={input}/></Field>
    <div className="md:col-span-2"><Field label="Descripción"><textarea name="description" rows={4} className={input}/></Field></div><div className="flex justify-end gap-3 md:col-span-2"><Link href="/projects" className="rounded-xl border px-5 py-3 font-semibold">Cancelar</Link><button className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white">Crear proyecto</button></div>
  </form></div></AppShell>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-sm font-semibold text-zinc-700">{label}{children}</label>}
function Select({name,options,required=false}:{name:string;options:Option[];required?:boolean}){return <select name={name} required={required} className={input}><option value="">Seleccionar</option>{options.map(o=><option key={o.id} value={o.id}>{o.name??o.full_name??o.id}</option>)}</select>}
