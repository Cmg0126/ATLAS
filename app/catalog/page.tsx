import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, Metric, PageTitle, primary, Section } from "../domain-ui";
import { createCatalogProduct, updateProductClassification } from "./actions";
import { PriceListImporter } from "./PriceListImporter";
import { ProductClassificationEditor } from "./ProductClassificationEditor";
import { TaxonomyFields, type TaxonomySystemOption } from "./TaxonomyFields";

type Product = {
  id: string;
  company_id: string;
  internal_sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  system_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  classification_status: string;
  classification_confidence: number | null;
  product_systems: { name: string } | null;
  product_categories: { name: string } | null;
  product_subcategories: { name: string } | null;
  supplier_prices: { unit_price: number; currency: string; created_at: string; suppliers: { name: string } | null }[];
};
type Import = {
  id: string; file_name: string; status: string; imported_rows: number; error_rows: number;
  classification_mode: string; created_at: string; suppliers: { name: string } | null;
};
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });

export default async function CatalogPage() {
  const [companies, suppliers, systems, products, imports] = await Promise.all([
    dbSelect<{ id: string; name: string }>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<{ id: string; name: string }>("suppliers", { select: "id,name", status: "eq.ACTIVE", order: "name.asc" }),
    dbSelect<TaxonomySystemOption>("product_systems", {
      select: "id,name,product_categories(id,name,product_subcategories(id,name))",
      active: "eq.true", order: "sort_order.asc,name.asc",
    }),
    dbSelect<Product>("catalog_products", {
      select: "id,company_id,internal_sku,name,brand,model,unit,system_id,category_id,subcategory_id,classification_status,classification_confidence,product_systems(name),product_categories(name),product_subcategories(name),supplier_prices(unit_price,currency,created_at,suppliers(name))",
      active: "eq.true", order: "name.asc",
    }),
    dbSelect<Import>("price_list_imports", {
      select: "id,file_name,status,imported_rows,error_rows,classification_mode,created_at,suppliers(name)",
      order: "created_at.desc", limit: 10,
    }),
  ]);
  const prices = products.flatMap((product) => product.supplier_prices || []);
  const pending = products.filter((product) => product.classification_status === "PENDING" || product.classification_status === "REVIEW").length;

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageTitle domain="Abastecimiento" title="Catálogo técnico y precios" description="Productos clasificados por sistemas ITLATAM, con precios históricos de proveedores." />
      <Link href="/catalog/settings" className={primary}>Configurar sistemas y categorías</Link>
    </div>
    <div className="mt-7 grid gap-4 md:grid-cols-4">
      <Metric label="Productos" value={String(products.length)} />
      <Metric label="Pendientes de clasificar" value={String(pending)} />
      <Metric label="Precios registrados" value={String(prices.length)} />
      <Metric label="Proveedores" value={String(suppliers.length)} />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <Section title="Importar lista de proveedor">
        <PriceListImporter companies={companies} suppliers={suppliers} systems={systems} />
      </Section>
      <Section title="Crear producto manualmente">
        <form action={createCatalogProduct} className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Empresa"><select required name="company_id" className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
          <Field label="Código interno"><input name="internal_sku" className={input} /></Field>
          <Field label="Nombre"><input required name="name" className={input} /></Field>
          <Field label="Marca"><input name="brand" className={input} /></Field>
          <Field label="Modelo / referencia"><input name="model" className={input} /></Field>
          <Field label="Unidad"><input name="unit" defaultValue="UND" className={input} /></Field>
          <TaxonomyFields systems={systems} />
          <Field label="IVA %"><input name="tax_percent" type="number" defaultValue="19" className={input} /></Field>
          <Field label="Tipo"><select name="item_type" className={input}><option value="INSTALLABLE">Equipo instalable</option><option value="CONSUMABLE">Consumible</option><option value="TOOL">Herramienta</option><option value="ASSET">Activo</option></select></Field>
          <Field label="Palabras clave"><input name="keywords" className={input} /></Field>
          <button className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black md:col-span-2">Crear producto</button>
        </form>
      </Section>
    </div>

    <section className="mt-7 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
      <table className="w-full min-w-[1050px] text-left text-sm text-zinc-200">
        <thead className="bg-zinc-900"><tr><th className="p-4">Producto</th><th>Clasificación ITLATAM</th><th>Marca / modelo</th><th>Unidad</th><th>Precios disponibles</th></tr></thead>
        <tbody className="divide-y divide-zinc-800">{products.map((product) => <tr key={product.id} className={product.classification_status === "PENDING" ? "bg-yellow-950/10" : ""}>
          <td className="p-4"><strong>{product.name}</strong><p className="text-xs text-zinc-500">{product.internal_sku || "Sin código interno"}</p></td>
          <td className="min-w-80 py-4 pr-4">
            <p>{[product.product_systems?.name, product.product_categories?.name, product.product_subcategories?.name].filter(Boolean).join(" → ") || "Pendiente de clasificación"}</p>
            <p className="mt-1 text-xs text-zinc-500">{product.classification_status}{product.classification_confidence !== null ? ` · ${Math.round(Number(product.classification_confidence) * 100)} % confianza` : ""}</p>
            <ProductClassificationEditor
              companyId={product.company_id} productId={product.id} systems={systems}
              systemId={product.system_id} categoryId={product.category_id} subcategoryId={product.subcategory_id}
              action={updateProductClassification}
            />
          </td>
          <td>{[product.brand, product.model].filter(Boolean).join(" · ") || "—"}</td>
          <td>{product.unit}</td>
          <td>{product.supplier_prices?.length
            ? product.supplier_prices.map((price, index) => <p key={`${price.created_at}-${index}`}>{price.suppliers?.name || "Proveedor"}: <strong>{money.format(Number(price.unit_price))}</strong></p>)
            : "Sin precio"}</td>
        </tr>)}</tbody>
      </table>
      {!products.length && <p className="p-10 text-center text-zinc-500">Importa una lista o crea el primer producto.</p>}
    </section>

    {!!imports.length && <Section title="Importaciones recientes"><div className="mt-3 divide-y divide-zinc-800">{imports.map((item) => <div key={item.id} className="flex justify-between gap-4 py-3 text-sm">
      <div><strong>{item.file_name}</strong><p className="text-zinc-500">{item.suppliers?.name} · {item.classification_mode === "AI" ? "Motor ITLATAM" : "Clasificación por bloque"} · {new Date(item.created_at).toLocaleString("es-CO")}</p></div>
      <span>{item.imported_rows} importados · {item.error_rows} novedades</span>
    </div>)}</div></Section>}
  </AppShell>;
}
