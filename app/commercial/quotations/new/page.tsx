import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createQuotation } from "../../actions";
import { getNextQuotationNumberPreview } from "../../quotation-number";
import { Field, input } from "../../ui";

type Opportunity = {
  id: string;
  title: string;
  clients: { name: string } | null;
};

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunity?: string }>;
}) {
  const { opportunity: selectedOpportunity = "" } = await searchParams;
  const [opportunities, nextQuotationNumber] = await Promise.all([
    dbSelect<Opportunity>("opportunities", {
      select: "id,title,clients(name)",
      order: "created_at.desc",
    }),
    getNextQuotationNumberPreview(),
  ]);

  return (
    <AppShell>
      <Link href="/commercial/quotations" className="font-semibold text-yellow-500">
        ← Cotizaciones
      </Link>
      <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-yellow-500">Comercial</p>
      <h1 className="mt-1 text-3xl font-bold">Nueva cotización</h1>
      <p className="mt-2 text-zinc-500">
        Selecciona la oportunidad y crea el encabezado. Después podrás agregar los ítems.
      </p>

      {!opportunities.length ? (
        <section className="mt-7 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Primero crea una oportunidad</h2>
          <p className="mt-2 text-zinc-500">
            Cada cotización debe quedar asociada a un cliente mediante una oportunidad comercial.
          </p>
          <Link href="/commercial/opportunities/new" className="mt-5 inline-block rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black">
            Crear oportunidad
          </Link>
        </section>
      ) : (
        <section className="mt-7 max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
          <form action={createQuotation} className="grid gap-5 md:grid-cols-2">
            <Field label="Cliente / oportunidad">
              <select name="opportunity_id" defaultValue={selectedOpportunity} required className={input}>
                <option value="">Seleccionar</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.id} value={opportunity.id}>
                    {opportunity.clients?.name || "Sin cliente"} — {opportunity.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-zinc-700">Número de cotización</p>
              <p className="mt-2 text-lg font-bold text-zinc-950">{nextQuotationNumber}</p>
              <p className="mt-1 text-xs text-zinc-500">Número estimado; ATLAS lo confirma y reserva al guardar.</p>
            </div>
            <Field label="Válida hasta">
              <input type="date" name="validity_date" className={input} />
            </Field>
            <Field label="Estado">
              <select name="status" defaultValue="DRAFT" className={input}>
                <option value="DRAFT">Borrador</option>
                <option value="SENT">Enviada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="REJECTED">Rechazada</option>
              </select>
            </Field>
            <Field label="Notas y condiciones comerciales">
              <textarea name="notes" rows={4} className={input} placeholder="Forma de pago, entrega y garantías..." />
            </Field>
            <div className="flex items-end">
              <button className="w-full rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black">
                Crear y agregar ítems
              </button>
            </div>
          </form>
        </section>
      )}
    </AppShell>
  );
}
