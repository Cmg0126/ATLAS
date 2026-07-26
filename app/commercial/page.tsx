import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { CommercialNav, Empty, Metric } from "./ui";

type Client = { id: string; name: string; nit: string | null; status: string };
type Opportunity = { id: string; title: string; stage: string; estimated_value: number; probability: number; clients: { name: string } | null };
type Quotation = { id: string; total: number; status: string };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default async function CommercialPage() {
  const [companies, clients, opportunities, quotations] = await Promise.all([
    dbSelect<{ id: string; name: string }>("companies", { select: "id,name" }),
    dbSelect<Client>("clients", { select: "id,name,nit,status", order: "created_at.desc" }),
    dbSelect<Opportunity>("opportunities", { select: "id,title,stage,estimated_value,probability,clients(name)", order: "created_at.desc" }),
    dbSelect<Quotation>("quotations", { select: "id,total,status" }),
  ]);
  const uniqueClients = clients.filter((client, index, all) =>
    all.findIndex((item) =>
      (item.nit && client.nit
        ? item.nit.trim() === client.nit.trim()
        : item.name.trim().toLocaleLowerCase("es") === client.name.trim().toLocaleLowerCase("es"))
    ) === index
  );
  const open = opportunities.filter((item) => !["WON", "LOST"].includes(item.stage));
  const pipeline = open.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0);
  const approved = quotations.filter((item) => item.status === "APPROVED").reduce((sum, item) => sum + Number(item.total || 0), 0);
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Dominio</p><h1 className="mt-1 text-3xl font-bold">Comercial</h1><p className="mt-2 text-zinc-500">Clientes, contactos, oportunidades y cotizaciones.</p></div><CommercialNav /></div>
    {!companies.length && <div className="mt-7 rounded-2xl border border-orange-200 bg-orange-50 p-6"><h2 className="text-xl font-bold">Configura la empresa para comenzar</h2><p className="mt-2 text-zinc-600">ATLAS necesita una empresa y una sede antes de registrar clientes.</p><Link href="/commercial/setup" className="mt-4 inline-block rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Configurar ahora</Link></div>}
    <div className="mt-7 grid gap-4 md:grid-cols-4"><Metric label="Clientes" value={String(uniqueClients.length)} /><Metric label="Oportunidades abiertas" value={String(open.length)} /><Metric label="Pipeline" value={money.format(pipeline)} /><Metric label="Cotizaciones aprobadas" value={money.format(approved)} /></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-bold">Clientes</h2><Link href="/commercial/clients/new" className="font-semibold text-orange-600">Crear</Link></div><div className="divide-y">{uniqueClients.map((client) => <Link key={client.id} href={`/commercial/clients/${client.id}`} className="flex items-center justify-between p-5 hover:bg-zinc-50"><div><p className="font-semibold">{client.name}</p><p className="text-sm text-zinc-500">{client.nit || "Sin NIT"}</p></div><span className="text-xs font-semibold">{client.status}</span></Link>)}{!uniqueClients.length && <Empty>No hay clientes registrados.</Empty>}</div></section>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-bold">Pipeline</h2><Link href="/commercial/opportunities/new" className="font-semibold text-orange-600">Crear</Link></div><div className="divide-y">{opportunities.map((opportunity) => <Link key={opportunity.id} href={`/commercial/opportunities/${opportunity.id}`} className="flex items-center justify-between gap-5 p-5 hover:bg-zinc-50"><div><p className="font-semibold">{opportunity.title}</p><p className="text-sm text-zinc-500">{opportunity.clients?.name || "Sin cliente"}</p></div><div className="text-right"><p className="font-semibold">{money.format(Number(opportunity.estimated_value || 0))}</p><p className="text-xs text-zinc-500">{opportunity.stage} · {opportunity.probability}%</p></div></Link>)}{!opportunities.length && <Empty>No hay oportunidades registradas.</Empty>}</div></section>
    </div>
  </AppShell>;
}
