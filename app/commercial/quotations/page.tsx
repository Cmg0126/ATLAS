import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { CommercialNav, Empty, Metric } from "../ui";

type Quotation = { id: string; quotation_number: string | null; total: number; status: string; opportunities: { id: string; title: string; clients: { name: string } | null } | null };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export default async function QuotationsPage() {
  const quotations = await dbSelect<Quotation>("quotations", { select: "id,quotation_number,total,status,opportunities(id,title,clients(name))", order: "created_at.desc" });
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">Comercial</p><h1 className="mt-1 text-3xl font-bold">Cotizaciones</h1></div><CommercialNav /></div>
    <div className="mt-7 grid gap-4 md:grid-cols-3"><Metric label="Total" value={String(quotations.length)} /><Metric label="Aprobadas" value={String(quotations.filter((q) => q.status === "APPROVED").length)} /><Metric label="Valor aprobado" value={money.format(quotations.filter((q) => q.status === "APPROVED").reduce((sum, q) => sum + Number(q.total || 0), 0))} /></div>
    <div className="mt-7 overflow-hidden rounded-2xl border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-5 py-4">Número</th><th className="px-5 py-4">Cliente / oportunidad</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Total</th><th /></tr></thead><tbody className="divide-y">{quotations.map((quote) => <tr key={quote.id}><td className="px-5 py-4 font-semibold">{quote.quotation_number || "Sin número"}</td><td className="px-5 py-4"><p>{quote.opportunities?.clients?.name || "Sin cliente"}</p><p className="text-xs text-zinc-500">{quote.opportunities?.title}</p></td><td className="px-5 py-4">{quote.status}</td><td className="px-5 py-4 font-semibold">{money.format(Number(quote.total || 0))}</td><td className="px-5 py-4">{quote.opportunities && <Link href={`/commercial/opportunities/${quote.opportunities.id}`} className="font-semibold text-orange-600">Abrir</Link>}</td></tr>)}</tbody></table>{!quotations.length && <Empty>No hay cotizaciones registradas.</Empty>}</div>
  </AppShell>;
}
