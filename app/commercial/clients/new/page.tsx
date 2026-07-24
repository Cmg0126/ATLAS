import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createClient } from "../../actions";
import { Field, input } from "../../ui";

export default async function NewClientPage() {
  const companies = await dbSelect<{ id: string; name: string }>("companies", { select: "id,name", order: "name.asc" });
  const uniqueCompanies = companies.filter((company, index, all) =>
    all.findIndex((item) => item.name.trim().toLocaleLowerCase("es") === company.name.trim().toLocaleLowerCase("es")) === index
  );
  return <AppShell><div className="mx-auto max-w-4xl"><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><h1 className="mt-4 text-3xl font-bold">Nuevo cliente</h1>
    {!companies.length ? <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6">Primero debes registrar la empresa que usa ATLAS. <Link className="font-bold text-orange-600" href="/commercial/setup">Configurar empresa</Link></div> :
    <form action={createClient} className="mt-8 grid gap-6 rounded-2xl border bg-white p-7 shadow-sm md:grid-cols-2">
      <Field label="Empresa"><select name="company_id" required className={input}>{uniqueCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
      <Field label="Razón social"><input name="name" required className={input} /></Field><Field label="NIT"><input name="nit" className={input} /></Field>
      <Field label="Estado"><select name="status" className={input}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></Field>
      <Field label="Correo"><input type="email" name="email" className={input} /></Field><Field label="Teléfono"><input name="phone" className={input} /></Field>
      <div className="flex justify-end md:col-span-2"><button className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white">Crear cliente</button></div>
    </form>}
  </div></AppShell>;
}
