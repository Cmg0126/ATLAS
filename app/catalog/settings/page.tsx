import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, PageTitle, primary, Section } from "../../domain-ui";
import { createProductCategory, createProductSubcategory, createProductSystem } from "../actions";

type Company = { id: string; name: string };
type System = {
  id: string;
  company_id: string;
  name: string;
  product_categories: {
    id: string;
    name: string;
    product_subcategories: { id: string; name: string }[];
  }[];
};

export default async function CatalogSettingsPage() {
  const [companies, systems] = await Promise.all([
    dbSelect<Company>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<System>("product_systems", {
      select: "id,company_id,name,product_categories(id,name,product_subcategories(id,name))",
      active: "eq.true", order: "sort_order.asc,name.asc",
    }),
  ]);
  const categories = systems.flatMap((system) =>
    system.product_categories.map((category) => ({ ...category, systemName: system.name })),
  );

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageTitle domain="Configuración ITLATAM" title="Clasificación de productos" description="Define la jerarquía que utilizarán el catálogo, las cotizaciones, los APU y los proyectos." />
      <Link href="/catalog" className={primary}>Volver al catálogo</Link>
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-3">
      <Section title="Crear sistema"><form action={createProductSystem} className="mt-4 space-y-4">
        <Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <Field label="Nombre"><input name="name" required className={input} placeholder="Ej. Automatización" /></Field>
        <Field label="Descripción"><textarea name="description" rows={2} className={input} /></Field>
        <button className={`${primary} w-full`}>Crear sistema</button>
      </form></Section>
      <Section title="Crear categoría"><form action={createProductCategory} className="mt-4 space-y-4">
        <Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <Field label="Sistema"><select name="system_id" required className={input}><option value="">Seleccionar</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></Field>
        <Field label="Nombre"><input name="name" required className={input} placeholder="Ej. CCTV" /></Field>
        <button className={`${primary} w-full`}>Crear categoría</button>
      </form></Section>
      <Section title="Crear subcategoría"><form action={createProductSubcategory} className="mt-4 space-y-4">
        <Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <Field label="Categoría"><select name="category_id" required className={input}><option value="">Seleccionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.systemName} → {category.name}</option>)}</select></Field>
        <Field label="Nombre"><input name="name" required className={input} placeholder="Ej. Cámaras" /></Field>
        <button className={`${primary} w-full`}>Crear subcategoría</button>
      </form></Section>
    </div>
    <div className="mt-7 grid gap-5 lg:grid-cols-2">
      {systems.map((system) => <section key={system.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-bold text-white">{system.name}</h2>
        <div className="mt-4 space-y-3">{system.product_categories.map((category) => <div key={category.id} className="rounded-xl bg-zinc-900 p-4">
          <p className="font-bold text-yellow-500">{category.name}</p>
          <p className="mt-2 text-sm text-zinc-400">{category.product_subcategories.map((subcategory) => subcategory.name).join(" · ") || "Sin subcategorías"}</p>
        </div>)}{!system.product_categories.length && <p className="text-sm text-zinc-500">Todavía no tiene categorías.</p>}</div>
      </section>)}
    </div>
  </AppShell>;
}
