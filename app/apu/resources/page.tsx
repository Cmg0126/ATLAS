import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { PageTitle } from "../../domain-ui";
import { createApuResource, updateApuResource } from "../actions";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
});

const typeNames = {
  EQUIPMENT: "Herramientas",
  MATERIAL: "Materiales",
  LABOR: "Mano de obra",
} as const;

type ResourceType = keyof typeof typeNames;
type Resource = {
  id: string;
  company_id: string;
  resource_type: ResourceType;
  code: string | null;
  description: string;
  unit: string;
  default_unit_cost: number;
  active: boolean;
};

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400";

export default async function ApuResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const [companies, resources] = await Promise.all([
    dbSelect<{ id: string; name: string }>("companies", {
      select: "id,name",
      order: "name.asc",
    }),
    dbSelect<Resource>("apu_resources", {
      select: "id,company_id,resource_type,code,description,unit,default_unit_cost,active",
      order: "resource_type.asc,description.asc",
    }),
  ]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          domain="Presupuestos"
          title="Biblioteca de recursos APU"
          description="Recursos reutilizables para herramientas, materiales y mano de obra."
        />
        <Link href="/apu" className="rounded-xl border border-zinc-700 px-4 py-3">
          Volver al Banco de APU
        </Link>
      </div>

      {saved && (
        <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-300">
          ✓ {saved}
        </div>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="h-fit rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-bold">Crear recurso reutilizable</h2>
          <form action={createApuResource} className="mt-4 space-y-4">
            <label className="block text-sm font-semibold">
              Empresa
              <select name="company_id" required defaultValue="" className={field}>
                <option value="" disabled>Seleccionar empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Grupo
              <select name="resource_type" required defaultValue="" className={field}>
                <option value="" disabled>Seleccionar grupo</option>
                {Object.entries(typeNames).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Código
              <input name="code" className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Descripción
              <input name="description" required className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">
                Unidad
                <input name="unit" defaultValue="UND" className={field} />
              </label>
              <label className="block text-sm font-semibold">
                Precio sugerido
                <input name="default_unit_cost" type="number" min="0" step="0.01" defaultValue="0" className={field} />
              </label>
            </div>
            <button className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">
              Guardar en biblioteca
            </button>
          </form>
        </section>

        <div className="space-y-5">
          {(Object.keys(typeNames) as ResourceType[]).map((type) => {
            const group = resources.filter((resource) => resource.resource_type === type);
            return (
              <section key={type} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                <div className="flex items-center justify-between bg-zinc-900 px-5 py-4">
                  <h2 className="text-lg font-bold text-yellow-400">{typeNames[type]}</h2>
                  <span className="text-sm text-zinc-400">{group.length} recursos</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {group.map((resource) => (
                    <form
                      key={resource.id}
                      action={updateApuResource}
                      className="grid gap-2 p-4 lg:grid-cols-[120px_1fr_90px_150px_110px_80px] lg:items-center"
                    >
                      <input type="hidden" name="resource_id" value={resource.id} />
                      <input type="hidden" name="company_id" value={resource.company_id} />
                      <input type="hidden" name="resource_type" value={resource.resource_type} />
                      <input name="code" defaultValue={resource.code || ""} aria-label="Código" className={field} />
                      <input name="description" required defaultValue={resource.description} aria-label="Descripción" className={field} />
                      <input name="unit" defaultValue={resource.unit} aria-label="Unidad" className={field} />
                      <input
                        name="default_unit_cost"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={resource.default_unit_cost}
                        aria-label="Precio sugerido"
                        className={field}
                      />
                      <select name="active" defaultValue={String(resource.active)} aria-label="Estado" className={field}>
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                      <button className="font-bold text-yellow-400">Guardar</button>
                      <p className="text-xs text-zinc-500 lg:col-span-6">
                        Precio sugerido actual: {money.format(Number(resource.default_unit_cost))}
                      </p>
                    </form>
                  ))}
                </div>
                {!group.length && <p className="p-5 text-sm text-zinc-500">No hay recursos en este grupo.</p>}
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
