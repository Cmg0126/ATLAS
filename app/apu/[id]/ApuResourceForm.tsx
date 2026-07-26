"use client";

import { useState } from "react";
import { addApuItem } from "../actions";

type ResourceType = "EQUIPMENT" | "MATERIAL" | "LABOR";
type Resource = {
  id: string;
  resource_type: ResourceType;
  code: string | null;
  description: string;
  unit: string;
  default_unit_cost: number;
};

const groups: { value: ResourceType; label: string }[] = [
  { value: "EQUIPMENT", label: "Herramientas" },
  { value: "MATERIAL", label: "Materiales" },
  { value: "LABOR", label: "Mano de obra" },
];

const field =
  "mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-white outline-none focus:border-yellow-400";

export function ApuResourceForm({
  apuId,
  companyId,
  resources,
}: {
  apuId: string;
  companyId: string;
  resources: Resource[];
}) {
  const [group, setGroup] = useState<ResourceType | "">("");
  const [resourceId, setResourceId] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("UND");
  const [unitCost, setUnitCost] = useState("0");

  const filteredResources = resources.filter((resource) => resource.resource_type === group);

  function changeGroup(nextGroup: ResourceType | "") {
    setGroup(nextGroup);
    setResourceId("");
    setCode("");
    setDescription("");
    setUnit("UND");
    setUnitCost("0");
  }

  function changeResource(nextId: string) {
    setResourceId(nextId);
    if (!nextId) {
      setCode("");
      setDescription("");
      setUnit("UND");
      setUnitCost("0");
      return;
    }
    const resource = resources.find((candidate) => candidate.id === nextId);
    if (!resource) return;
    setCode(resource.code || "");
    setDescription(resource.description);
    setUnit(resource.unit);
    setUnitCost(String(resource.default_unit_cost));
  }

  return (
    <form action={addApuItem} className="mt-4 space-y-4">
      <input type="hidden" name="apu_id" value={apuId} />
      <input type="hidden" name="company_id" value={companyId} />

      <label className="block text-sm font-semibold text-zinc-200">
        1. Grupo
        <select
          name="item_type"
          required
          value={group}
          onChange={(event) => changeGroup(event.target.value as ResourceType | "")}
          className={field}
        >
          <option value="" disabled>Seleccionar grupo</option>
          {groups.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        2. Recurso
        <select
          name="apu_resource_id"
          value={resourceId}
          onChange={(event) => changeResource(event.target.value)}
          disabled={!group}
          className={field}
        >
          <option value="">
            {group ? "Crear o escribir libremente" : "Primero selecciona el grupo"}
          </option>
          {filteredResources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.code ? `${resource.code} · ` : ""}
              {resource.description}
            </option>
          ))}
        </select>
      </label>

      <p className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
        Puedes modificar libremente todos los datos aunque elijas un recurso guardado.
      </p>

      <label className="block text-sm font-semibold text-zinc-200">
        Descripción
        <input
          name="description"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={field}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-zinc-200">
          Código
          <input
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm font-semibold text-zinc-200">
          Unidad
          <input
            name="unit"
            required
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className={field}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-zinc-200">
          Cantidad
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.0001"
            defaultValue="1"
            required
            className={field}
          />
        </label>
        <label className="block text-sm font-semibold text-zinc-200">
          Tarifa / precio unitario
          <input
            name="unit_cost"
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(event) => setUnitCost(event.target.value)}
            required
            className={field}
          />
        </label>
      </div>

      <button className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-black">
        Agregar y recalcular
      </button>
    </form>
  );
}
