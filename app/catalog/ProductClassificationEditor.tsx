"use client";

import { useState } from "react";
import { TaxonomyFields, type TaxonomySystemOption } from "./TaxonomyFields";

export function ProductClassificationEditor({
  companyId,
  productId,
  systems,
  systemId,
  categoryId,
  subcategoryId,
  action,
}: {
  companyId: string;
  productId: string;
  systems: TaxonomySystemOption[];
  systemId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  action: (data: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-yellow-500">Cambiar</button>;
  return <form action={action} className="mt-3 grid gap-3 rounded-xl border border-zinc-700 bg-black p-4 md:grid-cols-3">
    <input type="hidden" name="company_id" value={companyId} />
    <input type="hidden" name="product_id" value={productId} />
    <TaxonomyFields systems={systems} initialSystemId={systemId ?? ""} initialCategoryId={categoryId ?? ""} initialSubcategoryId={subcategoryId ?? ""} />
    <div className="flex gap-2 md:col-span-3">
      <button className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black">Guardar clasificación</button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2">Cancelar</button>
    </div>
  </form>;
}
