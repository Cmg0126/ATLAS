import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { saveCapturedProduct } from "./actions";

type Payload = {
  code?: string; model?: string; brand?: string; description?: string;
  price?: string; currency?: string; unit?: string; sourceUrl?: string;
};

function decodePayload(value?: string): Payload | null {
  if (!value || value.length > 12000) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Payload;
    const url = new URL(parsed.sourceUrl || "");
    return url.protocol === "https:" && url.hostname === "tienda.sonepar.co" ? parsed : null;
  } catch {
    return null;
  }
}

const field = "mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white outline-none focus:border-yellow-400";

export default async function CapturePage({ searchParams }: { searchParams: Promise<{ payload?: string }> }) {
  const payload = decodePayload((await searchParams).payload);
  const companies = await dbSelect<{ id: string; name: string }>("companies", { select: "id,name", order: "name.asc" });
  return <AppShell>
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-[.18em] text-yellow-400">Asistente de Chrome</p>
      <h1 className="mt-2 text-3xl font-bold">Revisar producto de Sonepar</h1>
      <p className="mt-2 text-zinc-400">Confirma los datos antes de agregarlos al catálogo. ATLAS aplicará el IVA configurado en la empresa y clasificará el producto automáticamente.</p>
      {!payload ? <div className="mt-7 rounded-2xl border border-red-900 bg-red-950/30 p-6">
        <strong>No recibí un producto válido.</strong>
        <p className="mt-2 text-zinc-300">Abre el producto en Sonepar y vuelve a pulsar el asistente.</p>
        <Link href="/catalog" className="mt-4 inline-block text-yellow-400">Volver al catálogo</Link>
      </div> :
      <form action={saveCapturedProduct} className="mt-7 grid gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:grid-cols-2">
        <label className="text-sm font-semibold text-zinc-200">Empresa<select required name="company_id" className={field}><option value="">Seleccionar</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-zinc-200">Código Sonepar<input required name="code" defaultValue={payload.code} className={field} /></label>
        <label className="text-sm font-semibold text-zinc-200">Referencia / modelo<input name="model" defaultValue={payload.model} className={field} /></label>
        <label className="text-sm font-semibold text-zinc-200">Marca<input name="brand" defaultValue={payload.brand} className={field} /></label>
        <label className="text-sm font-semibold text-zinc-200">Precio sin IVA<input required name="price" defaultValue={payload.price} inputMode="decimal" className={field} /></label>
        <label className="text-sm font-semibold text-zinc-200">Moneda<select name="currency" defaultValue={payload.currency || "COP"} className={field}><option value="COP">COP</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className="text-sm font-semibold text-zinc-200">Unidad<input name="unit" defaultValue={payload.unit || "UND"} className={field} /></label>
        <label className="text-sm font-semibold text-zinc-200 md:col-span-2">Descripción<textarea required name="description" defaultValue={payload.description} rows={5} className={field} /></label>
        <input type="hidden" name="source_url" value={payload.sourceUrl} />
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-black">Guardar en el catálogo</button>
          <Link href="/catalog" className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-zinc-200">Cancelar</Link>
        </div>
      </form>}
    </div>
  </AppShell>;
}
