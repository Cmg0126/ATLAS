import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";

type Project = { id:string; project_code:string; name:string; project_type:string; status:string; progress:number; contract_value:number; clients:{name:string}|null };
const money = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 });

export default async function ProjectsPage() {
  const projects = await dbSelect<Project>("projects", { select:"id,project_code,name,project_type,status,progress,contract_value,clients(name)", order:"created_at.desc" });
  const total = projects.reduce((sum,p)=>sum+Number(p.contract_value||0),0);
  const active = projects.filter(p=>!["COMPLETED","CANCELLED"].includes(p.status)).length;
  const average = projects.length ? Math.round(projects.reduce((sum,p)=>sum+Number(p.progress||0),0)/projects.length) : 0;
  return <AppShell>
    <div className="flex items-start justify-between gap-6"><div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Dominio</p><h1 className="mt-1 text-3xl font-bold">Proyectos</h1><p className="mt-2 text-zinc-500">Portafolio, ejecución, hitos, tareas y documentos técnicos.</p></div><Link href="/projects/new" className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Nuevo proyecto</Link></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric label="Proyectos activos" value={String(active)}/><Metric label="Avance promedio" value={`${average}%`}/><Metric label="Valor contratado" value={money.format(total)}/></div>
    <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-5 py-4">Proyecto</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Avance</th><th className="px-5 py-4">Valor</th><th></th></tr></thead><tbody className="divide-y">{projects.map(p=><tr key={p.id} className="hover:bg-zinc-50"><td className="px-5 py-4"><p className="font-semibold">{p.name}</p><p className="text-xs text-zinc-500">{p.project_code}</p></td><td className="px-5 py-4">{p.clients?.name||"Sin cliente"}</td><td className="px-5 py-4">{p.project_type}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4 min-w-40"><p className="mb-1 text-xs">{Number(p.progress)}%</p><div className="h-2 rounded-full bg-zinc-200"><div className="h-2 rounded-full bg-orange-500" style={{width:`${Math.min(100,Number(p.progress))}%`}}/></div></td><td className="px-5 py-4 font-medium">{money.format(Number(p.contract_value||0))}</td><td className="px-5 py-4"><Link href={`/projects/${p.id}`} className="font-semibold text-orange-600">Abrir</Link></td></tr>)}{!projects.length&&<tr><td colSpan={7} className="px-5 py-14 text-center text-zinc-500">No hay proyectos registrados.</td></tr>}</tbody></table></div></div>
  </AppShell>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>}
