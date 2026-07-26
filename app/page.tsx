import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const domains = [
  { name: "Comercial", href: "/commercial", description: "Clientes, oportunidades y cotizaciones" },
  { name: "Proyectos", href: "/projects", description: "Ejecución, tareas, hitos y documentos" },
  { name: "Licitaciones", href: "/tenders", description: "Procesos y requisitos de contratación" },
  { name: "Compras", href: "/purchasing", description: "Proveedores y órdenes de compra" },
  { name: "Inventario", href: "/inventory", description: "Existencias, entradas y salidas" },
  { name: "RR. HH.", href: "/hr", description: "Empleados y solicitudes" },
  { name: "SST", href: "/sst", description: "Incidentes e inspecciones" },
  { name: "Finanzas", href: "/finance", description: "Facturación, cartera y movimientos" },
  { name: "Atlas AI", href: "/atlas-ai", description: "Borradores documentales" },
];

export default async function Home() {
  const [clients, projects, tenders, invoices, tasks, incidents] = await Promise.all([
    dbSelect<{ id: string }>("clients", { select: "id" }),
    dbSelect<{ id: string; status: string }>("projects", { select: "id,status" }),
    dbSelect<{ id: string; status: string }>("tenders", { select: "id,status" }),
    dbSelect<{ total: number; paid_amount: number }>("invoices", { select: "total,paid_amount" }),
    dbSelect<{ id: string; status: string }>("project_tasks", { select: "id,status" }),
    dbSelect<{ id: string; status: string }>("sst_incidents", { select: "id,status" }),
  ]);
  const receivable = invoices.reduce((sum, item) => sum + Math.max(0, Number(item.total) - Number(item.paid_amount)), 0);
  return <AppShell>
    <div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">ATLAS ERP</p><h1 className="mt-1 text-3xl font-bold">Centro de operaciones</h1><p className="mt-2 text-zinc-500">Resumen real de ITLATAM GROUP S.A.S.</p></div>
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card title="Clientes" value={String(clients.length)} />
      <Card title="Proyectos activos" value={String(projects.filter(x => !["COMPLETED", "CANCELLED"].includes(x.status)).length)} />
      <Card title="Licitaciones abiertas" value={String(tenders.filter(x => !["WON", "LOST", "CANCELLED"].includes(x.status)).length)} />
      <Card title="Cartera" value={money.format(receivable)} />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Dominios operativos</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{domains.map(domain => <Link key={domain.href} href={domain.href} className="rounded-xl border p-4 transition hover:border-orange-400 hover:bg-orange-50"><p className="font-bold">{domain.name}</p><p className="mt-1 text-sm text-zinc-500">{domain.description}</p></Link>)}</div></section>
      <section className="rounded-2xl border bg-zinc-950 p-6 text-white shadow-sm"><h2 className="text-xl font-bold">Pendientes críticos</h2><div className="mt-5 space-y-4"><Pending label="Tareas abiertas" value={tasks.filter(x => x.status !== "DONE").length} href="/projects" /><Pending label="Incidentes SST abiertos" value={incidents.filter(x => x.status !== "CLOSED").length} href="/sst" /><Pending label="Licitaciones en proceso" value={tenders.filter(x => !["WON", "LOST", "CANCELLED"].includes(x.status)).length} href="/tenders" /></div></section>
    </div>
  </AppShell>;
}
function Card({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm text-zinc-500">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}
function Pending({ label, value, href }: { label: string; value: number; href: string }) {
  return <Link href={href} className="flex items-center justify-between rounded-xl bg-zinc-900 p-4"><span>{label}</span><strong className="rounded-full bg-orange-500 px-3 py-1">{value}</strong></Link>;
}
