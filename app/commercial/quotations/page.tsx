import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { CommercialNav, Empty, Metric } from "../ui";
import { DeleteQuotationButton } from "./DeleteQuotationButton";

type Quotation = {
  id: string; quotation_number: string | null; total: number; status: string; created_at: string;
  opportunities: { id: string; title: string; clients: { id: string; name: string } | null } | null;
};
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });
const statusLabels: Record<string, string> = { DRAFT: "Borrador", SENT: "Enviada", APPROVED: "Aprobada", REJECTED: "Rechazada" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: selectedClient = "" } = await searchParams;
  const quotations = await dbSelect<Quotation>("quotations", {
    select: "id,quotation_number,total,status,created_at,opportunities(id,title,clients(id,name))",
    order: "created_at.desc",
  });
  const clients = Array.from(new Map(quotations.flatMap((quote) => quote.opportunities?.clients ? [[quote.opportunities.clients.id, quote.opportunities.clients.name] as const] : [])).entries())
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const filtered = selectedClient
    ? quotations.filter((quote) => quote.opportunities?.clients?.id === selectedClient)
    : quotations;
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-yellow-500">Comercial</p><h1 className="mt-1 text-3xl font-bold text-white">Cotizaciones</h1><p className="mt-2 text-zinc-400">Consulta, filtra, exporta y administra todas las cotizaciones.</p></div>
      <div className="flex flex-wrap items-center gap-3"><CommercialNav /><Link href="/commercial/quotations/new" className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black">Nueva cotización</Link></div>
    </div>
    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <Metric label="Cotizaciones mostradas" value={String(filtered.length)} />
      <Metric label="Aprobadas" value={String(filtered.filter((quote) => quote.status === "APPROVED").length)} />
      <Metric label="Valor aprobado" value={money.format(filtered.filter((quote) => quote.status === "APPROVED").reduce((sum, quote) => sum + Number(quote.total || 0), 0))} />
    </div>
    <form className="mt-7 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm font-semibold text-zinc-200">Filtrar por cliente
        <select name="client" defaultValue={selectedClient} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white">
          <option value="">Todos los clientes</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </label>
      <button className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-black">Aplicar filtro</button>
      {selectedClient && <Link href="/commercial/quotations" className="rounded-xl border border-zinc-700 px-6 py-3 text-center font-semibold text-zinc-200">Limpiar</Link>}
    </form>
    <div className="mt-7 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
      <table className="w-full min-w-[900px] text-left text-sm text-zinc-200">
        <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-5 py-4">Número</th><th className="px-5 py-4">Cliente / oportunidad</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Total</th><th className="px-5 py-4">Acciones</th></tr></thead>
        <tbody className="divide-y divide-zinc-800">{filtered.map((quote) => <tr key={quote.id} className="hover:bg-zinc-900/60">
          <td className="px-5 py-4 font-semibold text-white">{quote.quotation_number || "Sin número"}</td>
          <td className="px-5 py-4"><p>{quote.opportunities?.clients?.name || "Sin cliente"}</p><p className="text-xs text-zinc-500">{quote.opportunities?.title}</p></td>
          <td className="px-5 py-4">{statusLabels[quote.status] || quote.status}</td>
          <td className="px-5 py-4 font-semibold">{money.format(Number(quote.total || 0))}</td>
          <td className="px-5 py-4"><div className="flex flex-wrap gap-4">
            {quote.opportunities && <Link href={`/commercial/opportunities/${quote.opportunities.id}`} className="font-semibold text-yellow-400">Abrir</Link>}
            <a href={`/api/commercial/quotations/${quote.id}/pdf`} className="font-semibold text-emerald-400">PDF</a>
            {quote.opportunities && <DeleteQuotationButton compact quotationId={quote.id} opportunityId={quote.opportunities.id} />}
          </div></td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <Empty>No hay cotizaciones para el cliente seleccionado.</Empty>}
    </div>
  </AppShell>;
}
