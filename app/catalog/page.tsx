import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, Metric, PageTitle, Section } from "../domain-ui";
import { createCatalogProduct } from "./actions";
import { PriceListImporter } from "./PriceListImporter";

type Product = {
  id: string; internal_sku: string | null; name: string; category: string | null;
  brand: string | null; model: string | null; unit: string;
  supplier_prices: { unit_price: number; currency: string; created_at: string; suppliers: { name: string } | null }[];
};
type Import = { id: string; file_name: string; status: string; imported_rows: number; error_rows: number; created_at: string; suppliers: { name: string } | null };
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });

export default async function CatalogPage() {
  const [companies, suppliers, products, imports] = await Promise.all([
    dbSelect<{ id: string; name: string }>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<{ id: string; name: string }>("suppliers", { select: "id,name", status: "eq.ACTIVE", order: "name.asc" }),
    dbSelect<Product>("catalog_products", {
      select: "id,internal_sku,name,category,brand,model,unit,supplier_prices(unit_price,currency,created_at,suppliers(name))",
      active: "eq.true", order: "name.asc",
    }),
    dbSelect<Import>("price_list_imports", {
      select: "id,file_name,status,imported_rows,error_rows,created_at,suppliers(name)", order: "created_at.desc", limit: 10,
    }),
  ]);
  const prices = products.flatMap((product) => product.supplier_prices || []);
  return <AppShell>
    <PageTitle domain="Abastecimiento" title="Catálogo y precios" description="Base informativa para cotizaciones, APU, compras y proyectos. No representa existencias físicas." />
    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <Metric label="Productos" value={String(products.length)} />
      <Metric label="Precios registrados" value={String(prices.length)} />
      <Metric label="Proveedores" value={String(suppliers.length)} />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <Section title="Importar lista de proveedor"><PriceListImporter companies={companies} suppliers={suppliers} /></Section>
      <Section title="Crear producto manualmente">
        <form action={createCatalogProduct} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Empresa"><select required name="company_id" className={input}><option value="">Seleccionar</option>{companies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Código interno"><input name="internal_sku" className={input} /></Field>
          <Field label="Nombre"><input required name="name" className={input} /></Field>
          <Field label="Categoría"><input name="category" className={input} /></Field>
          <Field label="Marca"><input name="brand" className={input} /></Field>
          <Field label="Modelo / referencia"><input name="model" className={input} /></Field>
          <Field label="Unidad"><input name="unit" defaultValue="UND" className={input} /></Field>
          <Field label="IVA %"><input name="tax_percent" type="number" defaultValue="19" className={input} /></Field>
          <Field label="Tipo"><select name="item_type" className={input}><option value="INSTALLABLE">Equipo instalable</option><option value="CONSUMABLE">Consumible</option><option value="TOOL">Herramienta</option><option value="ASSET">Activo</option></select></Field>
          <Field label="Palabras clave"><input name="keywords" className={input} /></Field>
          <button className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black md:col-span-2">Crear producto</button>
        </form>
      </Section>
    </div>
    <div className="mt-7 overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-zinc-50"><tr><th className="p-4">Producto</th><th>Código</th><th>Marca / modelo</th><th>Unidad</th><th>Precios disponibles</th></tr></thead>
        <tbody className="divide-y">{products.map(product => <tr key={product.id}><td className="p-4"><strong>{product.name}</strong><p className="text-xs text-zinc-500">{product.category || "Sin categoría"}</p></td><td>{product.internal_sku || "—"}</td><td>{[product.brand, product.model].filter(Boolean).join(" · ") || "—"}</td><td>{product.unit}</td><td>{product.supplier_prices?.length ? product.supplier_prices.map((price, index) => <p key={`${price.created_at}-${index}`}>{price.suppliers?.name || "Proveedor"}: <strong>{money.format(Number(price.unit_price))}</strong></p>) : "Sin precio"}</td></tr>)}</tbody>
      </table>
      {!products.length && <p className="p-10 text-center text-zinc-500">Importa una lista o crea el primer producto.</p>}
    </div>
    {!!imports.length && <Section title="Importaciones recientes"><div className="mt-3 divide-y">{imports.map(item => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm"><div><strong>{item.file_name}</strong><p className="text-zinc-500">{item.suppliers?.name} · {new Date(item.created_at).toLocaleString("es-CO")}</p></div><span>{item.imported_rows} importados · {item.error_rows} novedades</span></div>)}</div></Section>}
  </AppShell>;
}
