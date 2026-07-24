import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createDocument, createMilestone, createTask, updateProjectStatus, updateTask } from "../actions";

type Project = { id:string; project_code:string; name:string; description:string|null; project_type:string; status:string; priority:string; progress:number; contract_value:number; budget_cost:number; location:string|null; start_date:string|null; planned_end_date:string|null; clients:{name:string}|null; companies:{name:string}|null };
type Task = { id:string; title:string; status:string; priority:string; progress:number; due_date:string|null; profiles:{full_name:string|null}|null };
type Milestone = { id:string; name:string; status:string; due_date:string|null };
type Document = { id:string; document_code:string; title:string; document_type:string; revision:string; status:string; discipline:string|null };
type Profile = { id:string; full_name:string|null };

const input = "mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2.5 outline-none focus:border-orange-500";
const money = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 });

export default async function ProjectDetailPage({ params }: { params: Promise<{ id:string }> }) {
  const { id } = await params;
  const [project] = await dbSelect<Project>("projects", { select:"*,clients(name),companies(name)", id:`eq.${id}` });
  if (!project) notFound();
  const [tasks, milestones, documents, profiles] = await Promise.all([
    dbSelect<Task>("project_tasks", { select:"id,title,status,priority,progress,due_date,profiles:assigned_to(full_name)", project_id:`eq.${id}`, order:"created_at.desc" }),
    dbSelect<Milestone>("project_milestones", { select:"id,name,status,due_date", project_id:`eq.${id}`, order:"sort_order.asc,created_at.asc" }),
    dbSelect<Document>("engineering_documents", { select:"id,document_code,title,document_type,revision,status,discipline", project_id:`eq.${id}`, order:"created_at.desc" }),
    dbSelect<Profile>("profiles", { select:"id,full_name", is_active:"eq.true", order:"full_name.asc" }),
  ]);

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div><Link href="/projects" className="text-sm font-semibold text-orange-600">← Portafolio</Link><p className="mt-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">{project.project_code} · {project.project_type}</p><h1 className="mt-1 text-3xl font-bold">{project.name}</h1><p className="mt-2 max-w-3xl text-zinc-500">{project.description || "Sin descripción"}</p></div>
      <form action={updateProjectStatus} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <input type="hidden" name="project_id" value={project.id}/>
        <label className="text-xs font-semibold text-zinc-500">Estado<select name="status" defaultValue={project.status} className={input}><option value="PLANNING">Planeación</option><option value="ACTIVE">Activo</option><option value="ON_HOLD">Suspendido</option><option value="COMPLETED">Completado</option><option value="CANCELLED">Cancelado</option></select></label>
        <label className="text-xs font-semibold text-zinc-500">Avance %<input name="progress" type="number" min="0" max="100" defaultValue={project.progress} className={`${input} w-28`}/></label>
        <button className="rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white">Actualizar</button>
      </form>
    </div>

    <div className="mt-7 grid gap-4 md:grid-cols-4">
      <Metric label="Cliente" value={project.clients?.name || "Sin cliente"}/><Metric label="Contrato" value={money.format(Number(project.contract_value||0))}/><Metric label="Presupuesto" value={money.format(Number(project.budget_cost||0))}/><Metric label="Avance" value={`${Number(project.progress)}%`}/>
    </div>

    <Section title="Tareas" count={tasks.length}>
      <form action={createTask} className="grid gap-3 rounded-xl bg-zinc-50 p-4 md:grid-cols-6">
        <input type="hidden" name="project_id" value={project.id}/><input name="title" required placeholder="Nueva tarea" className={`${input} md:col-span-2`}/><select name="assigned_to" className={input}><option value="">Responsable</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><select name="milestone_id" className={input}><option value="">Hito</option>{milestones.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><input type="date" name="due_date" className={input}/><button className="mt-2 rounded-xl bg-orange-500 px-4 font-semibold text-white">Agregar</button>
      </form>
      <div className="mt-4 divide-y">{tasks.map(task=><div key={task.id} className="grid items-center gap-3 py-4 md:grid-cols-[1fr_160px_110px_250px]"><div><p className="font-semibold">{task.title}</p><p className="text-xs text-zinc-500">{task.profiles?.full_name || "Sin responsable"} · vence {task.due_date || "sin fecha"}</p></div><span className="text-sm">{task.priority}</span><span className="text-sm font-semibold">{Number(task.progress)}%</span><form action={updateTask} className="flex gap-2"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="task_id" value={task.id}/><select name="status" defaultValue={task.status} className="rounded-lg border px-2 py-2 text-sm"><option value="TODO">Pendiente</option><option value="IN_PROGRESS">En curso</option><option value="BLOCKED">Bloqueada</option><option value="DONE">Terminada</option></select><input name="progress" type="number" min="0" max="100" defaultValue={task.progress} className="w-20 rounded-lg border px-2"/><button className="rounded-lg bg-zinc-900 px-3 text-white">OK</button></form></div>)}{!tasks.length&&<Empty text="No hay tareas registradas."/>}</div>
    </Section>

    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Section title="Hitos" count={milestones.length}><form action={createMilestone} className="grid gap-3 rounded-xl bg-zinc-50 p-4 md:grid-cols-[1fr_160px_auto]"><input type="hidden" name="project_id" value={project.id}/><input name="name" required placeholder="Nombre del hito" className={input}/><input type="date" name="due_date" className={input}/><button className="mt-2 rounded-xl bg-orange-500 px-4 font-semibold text-white">Agregar</button></form><div className="mt-3 divide-y">{milestones.map(m=><div key={m.id} className="flex justify-between py-3"><div><p className="font-semibold">{m.name}</p><p className="text-xs text-zinc-500">{m.due_date || "Sin fecha"}</p></div><span className="text-xs font-semibold">{m.status}</span></div>)}{!milestones.length&&<Empty text="No hay hitos."/>}</div></Section>
      <Section title="Documentos de ingeniería" count={documents.length}><form action={createDocument} className="grid gap-3 rounded-xl bg-zinc-50 p-4 md:grid-cols-2"><input type="hidden" name="project_id" value={project.id}/><input name="document_code" required placeholder="Código" className={input}/><input name="title" required placeholder="Título" className={input}/><input name="document_type" required placeholder="Tipo: plano, memoria..." className={input}/><input name="discipline" placeholder="Disciplina" className={input}/><input name="revision" defaultValue="0" className={input}/><button className="mt-2 rounded-xl bg-orange-500 px-4 font-semibold text-white">Registrar</button></form><div className="mt-3 divide-y">{documents.map(d=><div key={d.id} className="flex justify-between gap-3 py-3"><div><p className="font-semibold">{d.document_code} · {d.title}</p><p className="text-xs text-zinc-500">{d.document_type} · Rev. {d.revision} · {d.discipline || "General"}</p></div><span className="text-xs font-semibold">{d.status}</span></div>)}{!documents.length&&<Empty text="No hay documentos registrados."/>}</div></Section>
    </div>
  </AppShell>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>}
function Section({title,count,children}:{title:string;count:number;children:React.ReactNode}){return <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold">{count}</span></div>{children}</section>}
function Empty({text}:{text:string}){return <p className="py-8 text-center text-sm text-zinc-500">{text}</p>}
