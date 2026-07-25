"use client";

import { useState } from "react";

type Option = { id: string; name: string };

export function PriceListImporter({ companies, suppliers }: { companies: Option[]; suppliers: Option[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("Leyendo y normalizando la lista...");
        const response = await fetch("/api/catalog/import", {
          method: "POST",
          body: new FormData(event.currentTarget),
        });
        const contentType = response.headers.get("content-type") ?? "";
        const result = contentType.includes("application/json")
          ? await response.json()
          : { error: `El servidor no pudo procesar el archivo (HTTP ${response.status}).` };
        setBusy(false);
        if (!response.ok) {
          setMessage(result.error || "No fue posible importar la lista.");
          return;
        }
        setMessage(`Importación terminada: ${result.imported} precios, ${result.errors} filas con novedad.`);
        event.currentTarget.reset();
      }}
    >
      <label className="block text-sm font-semibold text-zinc-200">Empresa
        <select name="company_id" required className="mt-2 w-full rounded-xl border bg-zinc-950 px-4 py-3">
          <option value="">Seleccionar</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-zinc-200">Proveedor
        <select name="supplier_id" required className="mt-2 w-full rounded-xl border bg-zinc-950 px-4 py-3">
          <option value="">Seleccionar</option>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold text-zinc-200">Lista de precios
        <input name="file" type="file" accept=".xlsx,.csv" required className="mt-2 w-full rounded-xl border bg-zinc-950 px-4 py-3" />
      </label>
      <p className="text-xs text-zinc-500">Reconoce automáticamente código, descripción, marca, referencia, unidad, precio, IVA y categoría.</p>
      <button disabled={busy} className="w-full rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black disabled:opacity-50">
        {busy ? "Importando..." : "Importar lista"}
      </button>
      {message && <p className="rounded-xl bg-zinc-900 p-3 text-sm text-zinc-200">{message}</p>}
    </form>
  );
}
