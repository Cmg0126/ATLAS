import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, Metric, PageTitle } from "../../domain-ui";
import {
  deleteApuItem,
  duplicateApu,
  updateApu,
  updateApuItem,
} from "../actions";
import { ApuResourceForm } from "./ApuResourceForm";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
});

const typeNames = {
  EQUIPMENT: "I. Herramientas",
  MATERIAL: "II. Materiales",
  LABOR: "III. Mano de obra",
} as const;

type ItemType = keyof typeof typeNames;
type Apu = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  status: string;
  version: number;
  administration_percent: number;
  contingency_percent: number;
  profit_percent: number;
  tax_on_profit_percent: number;
  direct_cost: number;
  administration_cost: number;
  contingency_cost: number;
  profit_cost: number;
  tax_cost: number;
  unit_price: number;
};
type Item = {
  id: string;
  item_type: ItemType;
  code: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
};
type Resource = {
  id: string;
  resource_type: ItemType;
  code: string | null;
  description: string;
  unit: string;
  default_unit_cost: number;
};

const compactInput =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400";

export default async function ApuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const [apu] = await dbSelect<Apu>("apu_templates", {
    select: "*",
    id: `eq.${id}`,
    limit: 1,
  });
  if (!apu) notFound();

  const [items, resources] = await Promise.all([
    dbSelect<Item>("apu_items", {
      select: "id,item_type,code,description,unit,quantity,unit_cost,subtotal",
      apu_id: `eq.${id}`,
      item_type: "in.(EQUIPMENT,MATERIAL,LABOR)",
      order: "item_type.asc,sort_order.asc,created_at.asc",
    }),
    dbSelect<Resource>("apu_resources", {
      select: "id,resource_type,code,description,unit,default_unit_cost",
      company_id: `eq.${apu.company_id}`,
      active: "eq.true",
      order: "resource_type.asc,description.asc",
    }),
  ]);

  const grouped = (Object.keys(typeNames) as ItemType[]).map((type) => ({
    type,
    items: items.filter((item) => item.item_type === type),
    subtotal: items
      .filter((item) => item.item_type === type)
      .reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
  }));

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          domain={`${apu.code} · Versión ${apu.version}`}
          title={apu.name}
          description={apu.description || "Análisis de precio unitario"}
        />
        <div className="flex gap-3">
          <Link href="/apu" className="rounded-xl border border-zinc-700 px-4 py-3">
            Banco de APU
          </Link>
          <Link href="/apu/resources" className="rounded-xl border border-zinc-700 px-4 py-3">
            Biblioteca de recursos
          </Link>
          <form action={duplicateApu}>
            <input type="hidden" name="apu_id" value={apu.id} />
            <input type="hidden" name="company_id" value={apu.company_id} />
            <button className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">
              Crear nueva versión
            </button>
          </form>
        </div>
      </div>
      {saved && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-300"
        >
          ✓ {saved}
        </div>
      )}

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <Metric label="Costo directo" value={money.format(Number(apu.direct_cost))} />
        <Metric
          label="AIU + IVA utilidad"
          value={money.format(
            Number(apu.administration_cost) +
              Number(apu.contingency_cost) +
              Number(apu.profit_cost) +
              Number(apu.tax_cost),
          )}
        />
        <Metric label={`Precio por ${apu.unit}`} value={money.format(Number(apu.unit_price))} />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          {grouped.map((group) => (
            <section
              key={group.type}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
            >
              <div className="flex items-center justify-between bg-zinc-900 px-5 py-4">
                <h2 className="text-lg font-bold text-yellow-400">{typeNames[group.type]}</h2>
                <strong>{money.format(group.subtotal)}</strong>
              </div>
              <div className="hidden grid-cols-[110px_1fr_90px_110px_150px_150px_70px] gap-2 border-b border-zinc-800 px-4 py-3 text-xs font-bold uppercase text-zinc-400 lg:grid">
                <span>Código</span>
                <span>Descripción</span>
                <span>Unidad</span>
                <span>Cantidad</span>
                <span>Tarifa / precio</span>
                <span>Valor unitario</span>
                <span></span>
              </div>
              <div className="divide-y divide-zinc-800">
                {group.items.map((item) => {
                  const formId = `edit-${item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="grid gap-2 px-4 py-4 lg:grid-cols-[110px_1fr_90px_110px_150px_150px_70px] lg:items-center"
                    >
                      <form id={formId} action={updateApuItem}>
                        <input type="hidden" name="apu_id" value={apu.id} />
                        <input type="hidden" name="company_id" value={apu.company_id} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <input type="hidden" name="item_type" value={group.type} />
                      </form>
                      <input
                        form={formId}
                        name="code"
                        defaultValue={item.code || ""}
                        aria-label="Código"
                        className={compactInput}
                      />
                      <input
                        form={formId}
                        name="description"
                        defaultValue={item.description}
                        aria-label="Descripción"
                        required
                        className={compactInput}
                      />
                      <input
                        form={formId}
                        name="unit"
                        defaultValue={item.unit}
                        aria-label="Unidad"
                        className={compactInput}
                      />
                      <input
                        form={formId}
                        name="quantity"
                        type="number"
                        min="0"
                        step="0.0001"
                        defaultValue={item.quantity}
                        aria-label="Cantidad"
                        className={compactInput}
                      />
                      <input
                        form={formId}
                        name="unit_cost"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={item.unit_cost}
                        aria-label="Tarifa o precio unitario"
                        className={compactInput}
                      />
                      <strong className="px-2 text-right">{money.format(Number(item.subtotal))}</strong>
                      <div className="flex flex-col gap-2 text-xs">
                        <button form={formId} className="font-bold text-yellow-400">
                          Guardar
                        </button>
                        <form action={deleteApuItem}>
                          <input type="hidden" name="apu_id" value={apu.id} />
                          <input type="hidden" name="company_id" value={apu.company_id} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <button className="text-red-400">Quitar</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!group.items.length && (
                <p className="p-5 text-sm text-zinc-500">Sin recursos en este grupo.</p>
              )}
              <div className="flex justify-end border-t border-zinc-800 bg-zinc-900/50 px-5 py-3">
                <span className="font-bold">
                  Subtotal {typeNames[group.type].replace(/^[IVX]+\.\s*/, "")}:{" "}
                  {money.format(group.subtotal)}
                </span>
              </div>
            </section>
          ))}
          <section className="flex items-center justify-between rounded-2xl border border-yellow-500/40 bg-yellow-400/10 px-5 py-5">
            <span className="text-lg font-bold">TOTAL COSTO DIRECTO</span>
            <strong className="text-xl text-yellow-400">{money.format(Number(apu.direct_cost))}</strong>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-bold">Agregar recurso</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Elige el grupo y luego selecciona un recurso de ese grupo o escríbelo libremente.
            </p>
            <ApuResourceForm apuId={apu.id} companyId={apu.company_id} resources={resources} />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-bold">Datos del APU y AIU</h2>
            <form action={updateApu} className="mt-4 space-y-4">
              <input type="hidden" name="apu_id" value={apu.id} />
              <input type="hidden" name="company_id" value={apu.company_id} />
              <Field label="Nombre">
                <input name="name" defaultValue={apu.name} className={input} />
              </Field>
              <Field label="Descripción">
                <textarea name="description" defaultValue={apu.description || ""} className={input} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unidad">
                  <input name="unit" defaultValue={apu.unit} className={input} />
                </Field>
                <Field label="Estado">
                  <select name="status" defaultValue={apu.status} className={input}>
                    <option value="DRAFT">Borrador</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="ARCHIVED">Archivado</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Administración %">
                  <input
                    name="administration_percent"
                    type="number"
                    step="0.01"
                    defaultValue={apu.administration_percent}
                    className={input}
                  />
                </Field>
                <Field label="Imprevistos %">
                  <input
                    name="contingency_percent"
                    type="number"
                    step="0.01"
                    defaultValue={apu.contingency_percent}
                    className={input}
                  />
                </Field>
                <Field label="Utilidad %">
                  <input
                    name="profit_percent"
                    type="number"
                    step="0.01"
                    defaultValue={apu.profit_percent}
                    className={input}
                  />
                </Field>
                <Field label="IVA utilidad %">
                  <input
                    name="tax_on_profit_percent"
                    type="number"
                    step="0.01"
                    defaultValue={apu.tax_on_profit_percent}
                    className={input}
                  />
                </Field>
              </div>
              <button className="w-full rounded-xl border border-yellow-500 px-4 py-3 font-bold text-yellow-400">
                Guardar y recalcular
              </button>
            </form>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
