import {
  convertQuotationToProject,
  createQuotationRevision,
  createQuotationItem,
  deleteQuotationItem,
  updateQuotationStatus,
} from "../../actions";
import { Empty, Field, input } from "../../ui";
import { ProductSearchFields, type CatalogProduct } from "./ProductSearchFields";
import { DeleteQuotationButton } from "../../quotations/DeleteQuotationButton";

export type QuotationItem = {
  id: string; description: string; unit: string; quantity: number; unit_price: number;
  discount_percent: number; tax_percent: number;
};
export type Quotation = {
  id: string; quotation_number: string | null; status: string; subtotal: number;
  discount_total: number; tax_total: number; total: number; validity_date: string | null;
  quotation_items: QuotationItem[];
};
type Option = { id: string; name: string };
type Props = {
  opportunityId: string; opportunityTitle: string; quotations: Quotation[];
  companies: Option[]; branches: Option[]; products: CatalogProduct[];
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function QuotationManager({ opportunityId, opportunityTitle, quotations, companies, branches, products }: Props) {
  return <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">Cotizaciones ({quotations.length})</h2>
    <div className="mt-4 space-y-6">
      {quotations.map((quotation) => <article key={quotation.id} className="rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-lg font-bold">{quotation.quotation_number || "Sin número"}</p><p className="text-2xl font-bold text-orange-500">{money.format(Number(quotation.total || 0))}</p>{quotation.validity_date && <p className="text-xs text-zinc-500">Válida hasta {quotation.validity_date}</p>}</div>
          <form action={updateQuotationStatus} className="flex gap-2">
            <input type="hidden" name="quotation_id" value={quotation.id} /><input type="hidden" name="opportunity_id" value={opportunityId} />
            <select name="status" defaultValue={quotation.status} className={input}><option value="DRAFT">Borrador</option><option value="SENT">Enviada</option><option value="APPROVED">Aprobada</option><option value="REJECTED">Rechazada</option></select>
            <button className="rounded-xl bg-zinc-950 px-4 py-2 font-semibold text-white">Guardar</button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/api/commercial/quotations/${quotation.id}/pdf`} className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black">
          Descargar PDF
        </a>
        <form action={createQuotationRevision}>
          <input type="hidden" name="quotation_id" value={quotation.id} />
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          <button className="rounded-xl border border-yellow-300 bg-zinc-900 px-4 py-2 text-sm font-semibold text-yellow-500">
            Crear nueva versión
          </button>
        </form>
        <DeleteQuotationButton quotationId={quotation.id} opportunityId={opportunityId} />
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-950/5 text-zinc-500"><tr><th className="px-4 py-3">Descripción</th><th>Unidad</th><th>Cantidad</th><th>Precio</th><th>Desc.</th><th>IVA</th><th /></tr></thead>
            <tbody className="divide-y">{quotation.quotation_items.map((item) => <tr key={item.id}>
              <td className="px-4 py-3 font-medium">{item.description}</td><td>{item.unit}</td><td>{Number(item.quantity)}</td><td>{money.format(Number(item.unit_price))}</td><td>{Number(item.discount_percent)}%</td><td>{Number(item.tax_percent)}%</td>
              <td className="px-4 text-right"><form action={deleteQuotationItem}><input type="hidden" name="item_id" value={item.id} /><input type="hidden" name="quotation_id" value={quotation.id} /><input type="hidden" name="opportunity_id" value={opportunityId} /><button className="font-semibold text-red-500">Eliminar</button></form></td>
            </tr>)}</tbody>
          </table>
          {!quotation.quotation_items.length && <p className="p-4 text-sm text-zinc-500">Agrega la primera partida.</p>}
        </div>
        <form action={createQuotationItem} className="mt-4 grid gap-3 rounded-xl border p-4 md:grid-cols-6">
          <input type="hidden" name="quotation_id" value={quotation.id} /><input type="hidden" name="opportunity_id" value={opportunityId} />
          <ProductSearchFields products={products} />
          <button className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white md:col-span-6">Agregar partida y recalcular</button>
        </form>
        <div className="ml-auto mt-4 grid max-w-sm grid-cols-2 gap-2 text-sm">
          <span>Subtotal bruto</span><strong className="text-right">{money.format(Number(quotation.subtotal || 0))}</strong>
          <span>Descuentos</span><strong className="text-right">− {money.format(Number(quotation.discount_total || 0))}</strong>
          <span>Impuestos</span><strong className="text-right">{money.format(Number(quotation.tax_total || 0))}</strong>
          <span className="text-lg font-bold">Total</span><strong className="text-right text-lg text-orange-500">{money.format(Number(quotation.total || 0))}</strong>
        </div>
        {quotation.status === "APPROVED" && <form action={convertQuotationToProject} className="mt-5 grid gap-3 rounded-xl bg-orange-50 p-4 md:grid-cols-3">
          <input type="hidden" name="quotation_id" value={quotation.id} />
          <Field label="Empresa"><select name="company_id" required className={input}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
          <Field label="Sede"><select name="branch_id" className={input}><option value="">Sin sede</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
          <Field label="Código del proyecto"><input name="project_code" required className={input} placeholder="PR-2026-001" /></Field>
          <Field label="Nombre"><input name="name" defaultValue={opportunityTitle} className={input} /></Field>
          <Field label="Tipo"><input name="project_type" required className={input} placeholder="CCTV, GPON..." /></Field>
          <Field label="Prioridad"><select name="priority" className={input}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></Field>
          <Field label="Costo presupuestado"><input type="number" name="budget_cost" min="0" className={input} /></Field>
          <Field label="Ubicación"><input name="location" className={input} /></Field>
          <div className="flex items-end"><button className="w-full rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white">Convertir en proyecto</button></div>
        </form>}
      </article>)}
      {!quotations.length && <Empty>No hay cotizaciones para esta oportunidad.</Empty>}
    </div>
  </section>;
}
