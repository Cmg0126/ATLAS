"use client";

import { useMemo, useState } from "react";
import { CurrencyInput } from "@/components/currency-input";
import { Field, input } from "../../ui";

export type CatalogProduct = {
  id: string;
  internal_sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  unit: string;
  tax_percent: number;
  supplier_prices: {
    id: string;
    unit_price: number;
    active: boolean;
    created_at: string;
    suppliers: { name: string } | null;
  }[];
};

const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2 });

export function ProductSearchFields({ products }: { products: CatalogProduct[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [price, setPrice] = useState("");
  const latestActivePrice = (product: CatalogProduct) =>
    product.supplier_prices
      .filter((supplierPrice) => supplierPrice.active)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;
  const selectedSupplierPrice = selected ? latestActivePrice(selected) : null;
  const results = useMemo(() => {
    const search = query.toLocaleLowerCase("es").trim();
    if (!search) return [];
    return products.filter((product) =>
      [product.internal_sku, product.name, product.brand, product.model].filter(Boolean)
        .join(" ").toLocaleLowerCase("es").includes(search)
    ).slice(0, 8);
  }, [products, query]);

  return <>
    <div className="md:col-span-6">
      <label className="block text-sm font-semibold text-zinc-200">Buscar producto o material
        <input value={query} onChange={(event) => setQuery(event.target.value)} className={input} placeholder="Código, descripción, marca o referencia" />
      </label>
      {!!results.length && <div className="mt-2 grid gap-2 rounded-xl border bg-zinc-950 p-2">
        {results.map((product) => {
          const supplierPrice = latestActivePrice(product);
          return <button
            key={product.id}
            type="button"
            onClick={() => {
              setSelected(product);
              setQuery([product.brand, product.model, product.name].filter(Boolean).join(" · "));
              setPrice(String(supplierPrice?.unit_price ?? ""));
            }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-zinc-800"
          >
            <span><strong>{product.name}</strong><small className="block text-zinc-500">{[product.internal_sku, product.brand, product.model].filter(Boolean).join(" · ")}</small></span>
            <span className="text-sm text-yellow-500">{supplierPrice ? `${supplierPrice.suppliers?.name || "Proveedor"} · ${money.format(Number(supplierPrice.unit_price))}` : "Sin precio"}</span>
          </button>;
        })}
      </div>}
    </div>
    <input type="hidden" name="product_id" value={selected?.id || ""} />
    <input type="hidden" name="supplier_price_id" value={selectedSupplierPrice?.id || ""} />
    <input type="hidden" name="reference_cost" value={selectedSupplierPrice?.unit_price || ""} />
    <Field label="Descripción"><input name="description" required className={input} defaultValue={selected?.name || ""} key={`description-${selected?.id || "manual"}`} /></Field>
    <Field label="Unidad"><input name="unit" required className={input} defaultValue={selected?.unit || "UND"} key={`unit-${selected?.id || "manual"}`} /></Field>
    <Field label="Cantidad"><input type="number" name="quantity" min="0.01" step="0.01" defaultValue="1" required className={input} /></Field>
    <Field label="Precio de venta"><CurrencyInput name="unit_price" value={price} onValueChange={setPrice} required className={input} /></Field>
    <Field label="Descuento %"><input type="number" name="discount_percent" min="0" max="100" step="0.01" defaultValue="0" className={input} /></Field>
    <Field label="IVA %"><input type="number" name="tax_percent" min="0" max="100" step="0.01" defaultValue={selected?.tax_percent ?? 19} key={`tax-${selected?.id || "manual"}`} className={input} /></Field>
  </>;
}
