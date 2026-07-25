import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createCompany, updateCompanySettings } from "../actions";
import { Field, input } from "../ui";

type Company = {
  id: string;
  name: string;
  default_tax_percent: number;
};

export default async function CommercialSetupPage() {
  const companies = await dbSelect<Company>("companies", {
    select: "id,name,default_tax_percent",
    order: "name.asc",
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <Link href="/commercial" className="font-semibold text-yellow-500">← Comercial</Link>
        <h1 className="mt-4 text-3xl font-bold">Configuración de la empresa</h1>
        <p className="mt-2 text-zinc-400">Define los parámetros generales que ATLAS aplicará automáticamente en todos los módulos.</p>

        {companies.map((company) => (
          <form key={company.id} action={updateCompanySettings} className="mt-8 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-7 md:grid-cols-2">
            <input type="hidden" name="company_id" value={company.id} />
            <Field label="Empresa"><input value={company.name} readOnly className={input} /></Field>
            <Field label="IVA general (%)">
              <input name="default_tax_percent" type="number" min="0" max="100" step="0.01" defaultValue={company.default_tax_percent ?? 19} required className={input} />
            </Field>
            <p className="text-sm text-zinc-400 md:col-span-2">Este porcentaje se aplica automáticamente a productos e importaciones. Las listas de proveedores no necesitan una columna de IVA.</p>
            <div className="flex justify-end md:col-span-2">
              <button className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-black">Guardar parámetros</button>
            </div>
          </form>
        ))}

        {!companies.length && (
          <form action={createCompany} className="mt-8 grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-7 md:grid-cols-2">
            <Field label="Empresa"><input name="name" required className={input} placeholder="ITLATAM GROUP SAS" /></Field>
            <Field label="Sede principal"><input name="branch_name" required className={input} placeholder="Cartagena" /></Field>
            <Field label="IVA general (%)"><input name="default_tax_percent" type="number" min="0" max="100" step="0.01" defaultValue="19" required className={input} /></Field>
            <div className="flex justify-end md:col-span-2"><button className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-black">Guardar empresa</button></div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
