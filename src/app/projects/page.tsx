import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";

type Project = {
  id: string;
  project_code: string;
  name: string;
  project_type: string;
  status: string;
  priority: string;
  progress: number;
  contract_value: number;
  planned_end_date: string | null;
  clients: { name: string } | null;
};

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default async function ProjectsPage() {
  const projects = await dbSelect<Project>("projects", {
    select: "id,project_code,name,project_type,status,priority,progress,contract_value,planned_end_date,clients(name)",
    order: "created_at.desc",
  });

  const total = projects.reduce((sum, item) => sum + Number(item.contract_value || 0), 0);
  const active = projects.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length;
  const average = projects.length
    ? Math.round(projects.reduce((sum, item) => sum + Number(item.progress || 0), 0) / projects.length)
    : 0;

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Dominio</p>
          <h1 className="mt-1 text-3xl font-bold text-zinc-950">Proyectos</h1>
          <p className="mt-2 text-zinc-500">Portafolio, ejecución, hitos, tareas y documentos técnicos.</p>
        </div>
        <Link href="/projects/new" className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600">
          Nuevo proyecto
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Metric label="Proyectos activos" value={String(active)} />
        <Metric label="Avance promedio" value={`${average}%`} />
        <Metric label="Valor contratado" value={money.format(total)} />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-5 py-4">Código / Proyecto</th>
                <th className="px-5 py-4">Cliente</th>
                <th className="px-5 py-4">Tipo</th>
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Avance</th>
                <th className="px-5 py-4">Valor</th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-zinc-950">{project.name}</div>
                    <div className="text-xs text-zinc-500">{project.project_code}</div>
                  </td>
                  <td className="px-5 py-4">{project.clients?.name ?? "Sin cliente"}</td>
                  <td className="px-5 py-4">{project.project_type}</td>
                  <td className="px-5 py-4"><Badge>{project.status}</Badge></td>
                  <td className="px-5 py-4 min-w-44">
                    <div className="mb-1 flex justify-between text-xs"><span>{Number(project.progress)}%</span></div>
                    <div className="h-2 rounded-full bg-zinc-200"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${Math.min(100, Number(project.progress))}%` }} /></div>
                  </td>
                  <td className="px-5 py-4 font-medium">{money.format(Number(project.contract_value || 0))}</td>
                  <td className="px-5 py-4 text-right"><Link href={`/projects/${project.id}`} className="font-semibold text-orange-600 hover:underline">Abrir</Link></td>
                </tr>
              ))}
              {!projects.length && (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-zinc-500">No hay proyectos. Crea el primero para iniciar el portafolio.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold text-zinc-950">{value}</p></div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{children}</span>;
}
