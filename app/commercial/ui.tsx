import Link from "next/link";

export const input = "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-orange-500";
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-zinc-700">{label}{children}</label>;
}
export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}
export function CommercialNav() {
  return <div className="flex flex-wrap gap-2">
    <Link className="rounded-xl border bg-white px-4 py-2 font-semibold" href="/commercial">Resumen</Link>
    <Link className="rounded-xl border bg-white px-4 py-2 font-semibold" href="/commercial/clients/new">Nuevo cliente</Link>
    <Link className="rounded-xl border bg-white px-4 py-2 font-semibold" href="/commercial/opportunities/new">Nueva oportunidad</Link>
    <Link className="rounded-xl border bg-white px-4 py-2 font-semibold" href="/commercial/quotations">Cotizaciones</Link>
    <Link className="rounded-xl border bg-white px-4 py-2 font-semibold" href="/commercial/setup">Configurar empresa</Link>
    <Link className="rounded-xl bg-yellow-500 px-4 py-2 font-semibold text-black" href="/commercial/quotations/new">Nueva cotización</Link>
  </div>;
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-zinc-500">{children}</p>;
}
