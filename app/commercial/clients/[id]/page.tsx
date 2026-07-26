import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createContact, updateClient } from "../../actions";
import { Empty, Field, input } from "../../ui";

type Client = { id: string; name: string; nit: string | null; email: string | null; phone: string | null; status: string };
type Contact = { id: string; full_name: string; position: string | null; email: string | null; phone: string | null };
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client] = await dbSelect<Client>("clients", { select: "*", id: `eq.${id}` });
  if (!client) notFound();
  const contacts = await dbSelect<Contact>("client_contacts", { select: "id,full_name,position,email,phone", client_id: `eq.${id}`, order: "created_at.desc" });
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><h1 className="mt-4 text-3xl font-bold">{client.name}</h1><p className="mt-2 text-zinc-500">{client.nit || "Sin NIT"}</p></div><Link href={`/commercial/opportunities/new?client=${id}`} className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Nueva oportunidad</Link></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Datos del cliente</h2><form action={updateClient} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="client_id" value={id} /><Field label="Razón social"><input name="name" required defaultValue={client.name} className={input} /></Field><Field label="NIT"><input name="nit" defaultValue={client.nit || ""} className={input} /></Field><Field label="Correo"><input type="email" name="email" defaultValue={client.email || ""} className={input} /></Field><Field label="Teléfono"><input name="phone" defaultValue={client.phone || ""} className={input} /></Field><Field label="Estado"><select name="status" defaultValue={client.status} className={input}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></Field><div className="flex items-end"><button className="w-full rounded-xl bg-zinc-950 px-5 py-3 font-semibold text-white">Guardar cambios</button></div></form></section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Agregar contacto</h2><form action={createContact} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="client_id" value={id} /><Field label="Nombre"><input name="full_name" required className={input} /></Field><Field label="Cargo"><input name="position" className={input} /></Field><Field label="Correo"><input type="email" name="email" className={input} /></Field><Field label="Teléfono"><input name="phone" className={input} /></Field><button className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white md:col-span-2">Agregar contacto</button></form></section>
    </div>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Contactos ({contacts.length})</h2></div><div className="divide-y">{contacts.map((contact) => <div key={contact.id} className="grid gap-2 p-5 md:grid-cols-4"><p className="font-semibold">{contact.full_name}</p><p>{contact.position || "Sin cargo"}</p><p>{contact.email || "Sin correo"}</p><p>{contact.phone || "Sin teléfono"}</p></div>)}{!contacts.length && <Empty>No hay contactos registrados.</Empty>}</div></section>
  </AppShell>;
}
