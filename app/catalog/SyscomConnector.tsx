"use client";

import { useState } from "react";

type Company = { id: string; name: string };
type Product = {
  id: string; model: string; name: string; brand: string; stock: number;
  price: number; listPrice: number; imageUrl: string | null; category: string | null;
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });

async function json(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  return type.includes("application/json") ? response.json() : { error: `Respuesta inválida (HTTP ${response.status}).` };
}

export function SyscomConnector({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function search() {
    if (query.trim().length < 2) return setMessage("Escribe una referencia o descripción.");
    setBusy(true); setMessage("");
    const response = await fetch(`/api/catalog/syscom/search?q=${encodeURIComponent(query.trim())}`);
    const result = await json(response);
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "No fue posible consultar SYSCOM.");
    setProducts(result.products ?? []);
    if (!result.products?.length) setMessage("SYSCOM no encontró productos con esa búsqueda.");
  }

  async function importProduct(product: Product) {
    if (!companyId) return setMessage("Selecciona la empresa.");
    setImporting(product.id); setMessage("Clasificando y guardando el producto...");
    const response = await fetch("/api/catalog/syscom/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, product }),
    });
    const result = await json(response);
    setImporting(null);
    if (!response.ok) return setMessage(result.error || "No fue posible importar.");
    setMessage(`${product.model || product.name} quedó guardado en el catálogo.`);
  }

  return <div className="mt-5 space-y-4">
    <div className="grid gap-3 md:grid-cols-[minmax(180px,0.6fr)_1fr_auto]">
      <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white">
        <option value="">Seleccionar empresa</option>
        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
      <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Referencia o descripción, ej. DS-2CD..." className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white" />
      <button type="button" onClick={search} disabled={busy} className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Consultando..." : "Buscar en SYSCOM"}</button>
    </div>
    <p className="text-xs text-zinc-500">Consulta precio y existencia en tiempo real. Al importar, ATLAS clasifica el producto y conserva el precio de SYSCOM como referencia.</p>
    {message && <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200">{message}</p>}
    {!!products.length && <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
      {products.map((product) => <article key={product.id} className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-semibold text-white">{product.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{[product.brand, product.model, product.category].filter(Boolean).join(" · ")}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm"><span className="font-semibold text-yellow-400">{money.format(product.price || product.listPrice)}</span><span className={product.stock > 0 ? "text-emerald-400" : "text-red-400"}>Existencia: {product.stock}</span></div>
        </div>
        <button type="button" onClick={() => importProduct(product)} disabled={Boolean(importing)} className="self-center rounded-xl border border-yellow-500 px-4 py-2 font-semibold text-yellow-400 disabled:opacity-50">{importing === product.id ? "Guardando..." : "Importar al catálogo"}</button>
      </article>)}
    </div>}
  </div>;
}
