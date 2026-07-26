import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, PageTitle, primary, Section } from "../../domain-ui";
import {
  createProductCategory,
  createProductSubcategory,
  createProductSystem,
  updateProductCategory,
  updateProductSubcategory,
  updateProductSystem,
} from "../actions";

type Company = { id: string; name: string };
type System = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  product_categories: {
    id: string;
    system_id: string;
    name: string;
    description: string | null;
    sort_order: number;
    active: boolean;
    product_subcategories: {
      id: string;
      category_id: string;
      name: string;
      description: string | null;
      sort_order: number;
      active: boolean;
    }[];
  }[];
};

export default async function CatalogSettingsPage() {
  const [companies, systems] = await Promise.all([
    dbSelect<Company>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<System>("product_systems", {
      select: "id,company_id,name,description,sort_order,active,product_categories(id,system_id,name,description,sort_order,active,product_subcategories(id,category_id,name,description,sort_order,active))",
      order: "sort_order.asc,name.asc",
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
    <div className="mt-7 space-y-5">
      {systems.map((system) => <section key={system.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <form action={updateProductSystem} className="grid gap-3 md:grid-cols-[2fr_3fr_100px_auto]">
          <input type="hidden" name="company_id" value={system.company_id} />
          <input type="hidden" name="system_id" value={system.id} />
          <Field label="Sistema"><input name="name" required defaultValue={system.name} className={input} /></Field>
          <Field label="Descripción"><input name="description" defaultValue={system.description || ""} className={input} /></Field>
          <Field label="Orden"><input name="sort_order" type="number" defaultValue={system.sort_order} className={input} /></Field>
          <div className="flex items-end gap-3 pb-1">
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input name="active" type="checkbox" defaultChecked={system.active} /> Activo</label>
            <button className="rounded-xl bg-yellow-400 px-4 py-2.5 font-semibold text-black">Guardar sistema</button>
          </div>
        </form>
        <div className="mt-5 space-y-4">{system.product_categories.map((category) => <div key={category.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <form action={updateProductCategory} className="grid gap-3 md:grid-cols-[2fr_3fr_100px_auto]">
            <input type="hidden" name="company_id" value={system.company_id} />
            <input type="hidden" name="system_id" value={system.id} />
            <input type="hidden" name="category_id" value={category.id} />
            <Field label="Categoría"><input name="name" required defaultValue={category.name} className={input} /></Field>
            <Field label="Descripción"><input name="description" defaultValue={category.description || ""} className={input} /></Field>
            <Field label="Orden"><input name="sort_order" type="number" defaultValue={category.sort_order} className={input} /></Field>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input name="active" type="checkbox" defaultChecked={category.active} /> Activa</label>
              <button className="rounded-xl border border-yellow-500 px-4 py-2.5 font-semibold text-yellow-400">Guardar categoría</button>
            </div>
          </form>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{category.product_subcategories.map((subcategory) => <form action={updateProductSubcategory} key={subcategory.id} className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
            <input type="hidden" name="company_id" value={system.company_id} />
            <input type="hidden" name="category_id" value={category.id} />
            <input type="hidden" name="subcategory_id" value={subcategory.id} />
            <div className="grid gap-3 sm:grid-cols-[2fr_90px]">
              <Field label="Subcategoría"><input name="name" required defaultValue={subcategory.name} className={input} /></Field>
              <Field label="Orden"><input name="sort_order" type="number" defaultValue={subcategory.sort_order} className={input} /></Field>
            </div>
            <Field label="Descripción"><input name="description" defaultValue={subcategory.description || ""} className={input} /></Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300"><input name="active" type="checkbox" defaultChecked={subcategory.active} /> Activa</label>
              <button className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-semibold text-white">Guardar subcategoría</button>
            </div>
          </form>)}{!category.product_subcategories.length && <p className="text-sm text-zinc-500">Sin subcategorías.</p>}</div>
        </div>)}{!system.product_categories.length && <p className="text-sm text-zinc-500">Todavía no tiene categorías.</p>}</div>
      </section>)}
    </div>
  </AppShell>;
}
