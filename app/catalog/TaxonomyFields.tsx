"use client";

import { useState } from "react";

export type TaxonomySystemOption = {
  id: string;
  name: string;
  product_categories: {
    id: string;
    name: string;
    product_subcategories: { id: string; name: string }[];
  }[];
};

export function TaxonomyFields({
  systems,
  initialSystemId = "",
  initialCategoryId = "",
  initialSubcategoryId = "",
  required = false,
}: {
  systems: TaxonomySystemOption[];
  initialSystemId?: string;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  required?: boolean;
}) {
  const [systemId, setSystemId] = useState(initialSystemId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const categories = systems.find((system) => system.id === systemId)?.product_categories ?? [];
  const subcategories = categories.find((category) => category.id === categoryId)?.product_subcategories ?? [];
  const selectClass = "mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white";

  return <>
    <label className="block text-sm font-semibold text-zinc-200">Sistema
      <select name="system_id" required={required} value={systemId} onChange={(event) => {
        setSystemId(event.target.value); setCategoryId(""); setSubcategoryId("");
      }} className={selectClass}>
        <option value="">Sin clasificar</option>
        {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold text-zinc-200">Categoría
      <select name="category_id" required={required} value={categoryId} disabled={!systemId} onChange={(event) => {
        setCategoryId(event.target.value); setSubcategoryId("");
      }} className={selectClass}>
        <option value="">Sin clasificar</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold text-zinc-200">Subcategoría
      <select name="subcategory_id" required={required} value={subcategoryId} disabled={!categoryId} onChange={(event) => setSubcategoryId(event.target.value)} className={selectClass}>
        <option value="">Sin clasificar</option>
        {subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
      </select>
    </label>
  </>;
}
