export const input = "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-orange-500";
export const primary = "rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white";
export const dark = "rounded-xl bg-zinc-950 px-4 py-2.5 font-semibold text-white";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-zinc-700">{label}{children}</label>;
}
export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>;
}
export function PageTitle({ domain, title, description }: { domain: string; title: string; description: string }) {
  return <div><p className="text-sm font-semibold uppercase tracking-widest text-orange-600">{domain}</p><h1 className="mt-1 text-3xl font-bold">{title}</h1><p className="mt-2 text-zinc-500">{description}</p></div>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{title}</h2>{children}</section>;
}
export function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-zinc-500">{text}</p>;
}
