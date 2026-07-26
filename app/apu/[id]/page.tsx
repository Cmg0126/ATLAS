import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, Metric, PageTitle } from "../../domain-ui";
import { addApuItem, deleteApuItem, duplicateApu, updateApu } from "../actions";

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });
const typeNames: Record<string, string> = {
  MATERIAL: "Materiales", LABOR: "Mano de obra", EQUIPMENT: "Equipos y herramientas",
  TRANSPORT: "Transporte", SUBCONTRACT: "Subcontratos", OTHER: "Otros",
};
type Apu = {
  id: string; company_id: string; code: string; name: string; description: string | null; unit: string; status: string; version: number;
  administration_percent: number; contingency_percent: number; profit_percent: number; tax_on_profit_percent: number;
  direct_cost: number; administration_cost: number; contingency_cost: number; profit_cost: number; tax_cost: number; unit_price: number;
};
type Item = { id: string; item_type: string; code: string | null; description: string; unit: string; quantity: number; performance: number; waste_percent: number; unit_cost: number; subtotal: number };
type Product = { id: string; internal_sku: string | null; name: string; brand: string | null; model: string | null };

export default async function ApuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [apu] = await dbSelect<Apu>("apu_templates", { select: "*", id: `eq.${id}`, limit: 1 });
  if (!apu) notFound();
  const [items, products] = await Promise.all([
    dbSelect<Item>("apu_items", { select: "id,item_type,code,description,unit,quantity,performance,waste_percent,unit_cost,subtotal", apu_id: `eq.${id}`, order: "item_type.asc,sort_order.asc,created_at.asc" }),
    dbSelect<Product>("catalog_products", { select: "id,internal_sku,name,brand,model", company_id: `eq.${apu.company_id}`, active: "eq.true", order: "name.asc" }),
  ]);
  const grouped = Object.keys(typeNames).map((type) => ({ type, items: items.filter((item) => item.item_type === type) }));
  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageTitle domain={`${apu.code} · Versión ${apu.version}`} title={apu.name} description={apu.description || "Análisis de precio unitario"} />
      <div className="flex gap-3"><Link href="/apu" className="rounded-xl border border-zinc-700 px-4 py-3">Banco de APU</Link>
        <form action={duplicateApu}><input type="hidden" name="apu_id" value={apu.id} /><input type="hidden" name="company_id" value={apu.company_id} /><button className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Crear nueva versión</button></form>
      </div>
    </div>
    <div className="mt-7 grid gap-4 md:grid-cols-3">
      <Metric label="Costo directo" value={money.format(Number(apu.direct_cost))} />
      <Metric label="AIU + IVA utilidad" value={money.format(Number(apu.administration_cost) + Number(apu.contingency_cost) + Number(apu.profit_cost) + Number(apu.tax_cost))} />
      <Metric label={`Precio por ${apu.unit}`} value={money.format(Number(apu.unit_price))} />
    </div>
    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        {grouped.map((group) => <section key={group.type} className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <h2 className="bg-zinc-900 px-5 py-4 text-lg font-bold text-yellow-400">{typeNames[group.type]}</h2>
          <table className="w-full min-w-[780px] text-left text-sm"><thead className="text-zinc-400"><tr><th className="p-4">Recurso</th><th>Cantidad</th><th>Rendimiento</th><th>Desperdicio</th><th>Costo unitario</th><th>Subtotal</th><th></th></tr></thead>
            <tbody className="divide-y divide-zinc-800">{group.items.map((item) => <tr key={item.id}>
              <td className="p-4"><strong>{item.description}</strong><p className="text-xs text-zinc-500">{item.code || "Sin código"} · {item.unit}</p></td>
              <td>{Number(item.quantity)}</td><td>{Number(item.performance)}</td><td>{Number(item.waste_percent)} %</td>
              <td>{money.format(Number(item.unit_cost))}</td><td className="font-bold">{money.format(Number(item.subtotal))}</td>
              <td><form action={deleteApuItem}><input type="hidden" name="apu_id" value={apu.id} /><input type="hidden" name="company_id" value={apu.company_id} /><input type="hidden" name="item_id" value={item.id} /><button className="text-red-400">Quitar</button></form></td>
            </tr>)}</tbody>
          </table>
          {!group.items.length && <p className="p-5 text-sm text-zinc-500">Sin recursos en este grupo.</p>}
        </section>)}
      </div>
      <div className="space-y-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-bold">Agregar recurso</h2>
          <form action={addApuItem} className="mt-4 space-y-4">
            <input type="hidden" name="apu_id" value={apu.id} /><input type="hidden" name="company_id" value={apu.company_id} />
            <Field label="Tipo"><select name="item_type" className={input}>{Object.entries(typeNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            <Field label="Producto del catálogo (opcional)"><select name="catalog_product_id" className={input}><option value="">Ingreso manual</option>{products.map((product) => <option key={product.id} value={product.id}>{product.internal_sku ? `${product.internal_sku} · ` : ""}{product.name}</option>)}</select></Field>
            <Field label="Descripción manual"><input name="description" className={input} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Código"><input name="code" className={input} /></Field><Field label="Unidad"><input name="unit" defaultValue="UND" className={input} /></Field></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad"><input name="quantity" type="number" step="0.0001" defaultValue="1" className={input} /></Field>
              <Field label="Rendimiento"><input name="performance" type="number" step="0.0001" defaultValue="1" className={input} /></Field>
              <Field label="Desperdicio %"><input name="waste_percent" type="number" step="0.01" defaultValue="0" className={input} /></Field>
              <Field label="Costo unitario"><input name="unit_cost" type="number" step="0.01" defaultValue="0" className={input} /></Field>
            </div>
            <button className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">Agregar y recalcular</button>
          </form>
        </section>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-bold">Configuración y AIU</h2>
          <form action={updateApu} className="mt-4 space-y-4">
            <input type="hidden" name="apu_id" value={apu.id} /><input type="hidden" name="company_id" value={apu.company_id} />
            <Field label="Nombre"><input name="name" defaultValue={apu.name} className={input} /></Field>
            <Field label="Descripción"><textarea name="description" defaultValue={apu.description || ""} className={input} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Unidad"><input name="unit" defaultValue={apu.unit} className={input} /></Field><Field label="Estado"><select name="status" defaultValue={apu.status} className={input}><option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option><option value="ARCHIVED">Archivado</option></select></Field></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Administración %"><input name="administration_percent" type="number" step="0.01" defaultValue={apu.administration_percent} className={input} /></Field>
              <Field label="Imprevistos %"><input name="contingency_percent" type="number" step="0.01" defaultValue={apu.contingency_percent} className={input} /></Field>
              <Field label="Utilidad %"><input name="profit_percent" type="number" step="0.01" defaultValue={apu.profit_percent} className={input} /></Field>
              <Field label="IVA utilidad %"><input name="tax_on_profit_percent" type="number" step="0.01" defaultValue={apu.tax_on_profit_percent} className={input} /></Field>
            </div>
            <button className="w-full rounded-xl border border-yellow-500 px-4 py-3 font-bold text-yellow-400">Guardar y recalcular</button>
          </form>
        </section>
      </div>
    </div>
  </AppShell>;
}
