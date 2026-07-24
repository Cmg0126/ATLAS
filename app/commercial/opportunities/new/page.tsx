import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createOpportunity } from "../../actions";
import { Field, input } from "../../ui";

export default async function NewOpportunityPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: selectedClient } = await searchParams;
  const clients = await dbSelect<{ id: string; name: string }>("clients", { select: "id,name", status: "eq.ACTIVE", order: "name.asc" });
  return <AppShell><div className="mx-auto max-w-4xl"><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><h1 className="mt-4 text-3xl font-bold">Nueva oportunidad</h1>
    {!clients.length ? <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6">Primero debes crear un cliente. <Link href="/commercial/clients/new" className="font-bold text-orange-600">Crear cliente</Link></div> :
    <form action={createOpportunity} className="mt-8 grid gap-6 rounded-2xl border bg-white p-7 shadow-sm md:grid-cols-2">
      <Field label="Cliente"><select name="client_id" required defaultValue={selectedClient || ""} className={input}><option value="">Seleccionar</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
      <Field label="Oportunidad"><input name="title" required className={input} placeholder="Sistema CCTV Hotel..." /></Field>
      <Field label="Etapa"><select name="stage" className={input}><option value="PROSPECT">Prospecto</option><option value="QUALIFIED">Calificada</option><option value="PROPOSAL">Propuesta</option><option value="NEGOTIATION">Negociación</option></select></Field>
      <Field label="Probabilidad %"><input type="number" name="probability" min="0" max="100" defaultValue="10" className={input} /></Field>
      <Field label="Valor estimado"><input type="number" name="estimated_value" min="0" className={input} /></Field><Field label="Cierre esperado"><input type="date" name="expected_close_date" className={input} /></Field>
      <div className="flex justify-end md:col-span-2"><button className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white">Crear oportunidad</button></div>
    </form>}
  </div></AppShell>;
}
