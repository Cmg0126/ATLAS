"use client";

import { useRef, useState } from "react";
import { TaxonomyFields, type TaxonomySystemOption } from "./TaxonomyFields";

type Option = { id: string; name: string };
type MappingKey = "sku" | "name" | "brand" | "model" | "unit" | "price" | "tax";
type Mapping = Record<MappingKey, number>;
type Preview = {
  headerIndex: number;
  headers: string[];
  previewRows: string[][];
  suggestedMapping: Mapping;
};

const fields: { key: MappingKey; label: string; required?: boolean }[] = [
  { key: "sku", label: "Código del proveedor" },
  { key: "name", label: "Descripción", required: true },
  { key: "brand", label: "Marca" },
  { key: "model", label: "Modelo / referencia" },
  { key: "unit", label: "Unidad" },
  { key: "price", label: "Precio", required: true },
  { key: "tax", label: "IVA %" },
];

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response.json()
    : { error: `El servidor no pudo procesar el archivo (HTTP ${response.status}).` };
}

export function PriceListImporter({ companies, suppliers, systems }: { companies: Option[]; suppliers: Option[]; systems: TaxonomySystemOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [classificationMode, setClassificationMode] = useState<"BLOCK" | "AI">("BLOCK");
  const [progress, setProgress] = useState({ value: 0, label: "" });

  async function requestPreview() {
    if (!formRef.current?.reportValidity()) return;
    setBusy(true);
    setMessage("Leyendo las columnas del archivo...");
    const formData = new FormData(formRef.current);
    formData.set("mode", "preview");
    const response = await fetch("/api/catalog/import", { method: "POST", body: formData });
    const result = await readResponse(response);
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error || "No fue posible leer la lista.");
      return;
    }
    setPreview(result as Preview);
    setMapping((result as Preview).suggestedMapping);
    setMessage("");
  }

  async function confirmImport() {
    if (!formRef.current || !preview || !mapping) return;
    if (mapping.name < 0 || mapping.price < 0) {
      setMessage("Debes emparejar Descripción y Precio antes de importar.");
      return;
    }
    setBusy(true);
    setProgress({ value: 8, label: "Enviando el archivo al servidor" });
    setMessage("Importando y actualizando precios...");
    const formData = new FormData(formRef.current);
    formData.set("mode", "import");
    formData.set("header_index", String(preview.headerIndex));
    formData.set("mapping", JSON.stringify(mapping));
    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        const next = current.value < 45
          ? current.value + 5
          : current.value < 75
            ? current.value + 3
            : Math.min(92, current.value + 1);
        const label = next < 35
          ? "Leyendo y validando productos"
          : next < 70
            ? classificationMode === "AI"
              ? "Motor ITLATAM clasificando productos y marcas"
              : "Aplicando clasificación al bloque"
            : "Guardando productos y precios";
        return { value: next, label };
      });
    }, 700);
    const response = await fetch("/api/catalog/import", { method: "POST", body: formData });
    const result = await readResponse(response);
    window.clearInterval(progressTimer);
    setBusy(false);
    if (!response.ok) {
      setProgress({ value: 0, label: "" });
      setMessage(result.error || "No fue posible importar la lista.");
      return;
    }
    setProgress({ value: 100, label: "Importación terminada" });
    const firstError = Array.isArray(result.errorDetails) && result.errorDetails.length
      ? ` Primera novedad: fila ${result.errorDetails[0].row}: ${result.errorDetails[0].message}`
      : "";
    setMessage(result.failed
      ? `No se importó ninguna fila.${firstError}`
      : `Importación terminada: ${result.imported} precios, ${result.errors} filas con novedad.${firstError}`);
    setPreview(null);
    setMapping(null);
    formRef.current.reset();
  }

  return (
    <>
      <form ref={formRef} className="mt-5 space-y-4" onSubmit={(event) => event.preventDefault()}>
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
        <fieldset className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <legend className="px-2 text-sm font-semibold text-zinc-200">Método de clasificación</legend>
          <label className="flex gap-3 py-2 text-sm text-zinc-200"><input type="radio" name="classification_mode" value="BLOCK" checked={classificationMode === "BLOCK"} onChange={() => setClassificationMode("BLOCK")} />Aplicar una clasificación a todo el bloque</label>
          <label className="flex gap-3 py-2 text-sm text-zinc-200"><input type="radio" name="classification_mode" value="AI" checked={classificationMode === "AI"} onChange={() => setClassificationMode("AI")} />Motor ITLATAM: analizar referencia y descripción</label>
        </fieldset>
        {classificationMode === "BLOCK"
          ? <div className="grid gap-4"><TaxonomyFields systems={systems} required /></div>
          : <p className="rounded-xl border border-yellow-900 bg-yellow-950/30 p-4 text-sm text-yellow-200">La IA completará únicamente clasificaciones confiables. Los productos dudosos quedarán en la bandeja de pendientes para que los corrijas después.</p>}
        <p className="text-xs text-zinc-500">ATLAS mostrará una vista previa para que emparejes las columnas antes de guardar.</p>
        <button type="button" disabled={busy} onClick={requestPreview} className="w-full rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black disabled:opacity-50">
          {busy ? "Leyendo archivo..." : "Continuar y emparejar columnas"}
        </button>
        {message && !preview && <p className="rounded-xl bg-zinc-900 p-3 text-sm text-zinc-200">{message}</p>}
      </form>

      {preview && mapping && (
        <div role="dialog" aria-modal="true" aria-labelledby="mapping-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-yellow-500">Importación de precios</p>
                <h2 id="mapping-title" className="mt-1 text-2xl font-bold text-white">Emparejar columnas</h2>
                <p className="mt-2 text-sm text-zinc-400">Confirma qué columna del archivo corresponde a cada campo de ATLAS.</p>
              </div>
              <button type="button" onClick={() => { setPreview(null); setMapping(null); setMessage(""); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-800">Cerrar</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {fields.map((field) => (
                <label key={field.key} className="text-sm font-semibold text-zinc-200">
                  {field.label}{field.required && <span className="text-yellow-500"> *</span>}
                  <select
                    value={mapping[field.key]}
                    onChange={(event) => setMapping({ ...mapping, [field.key]: Number(event.target.value) })}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-white"
                  >
                    <option value={-1}>No importar</option>
                    {preview.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-7 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[800px] text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-100"><tr>{preview.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap p-3">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-800">
                  {preview.previewRows.map((row, rowIndex) => <tr key={rowIndex}>{preview.headers.map((_, columnIndex) => <td key={columnIndex} className="max-w-64 truncate p-3">{row[columnIndex] || "—"}</td>)}</tr>)}
                </tbody>
              </table>
            </div>

            {message && <p className="mt-4 rounded-xl bg-zinc-900 p-3 text-sm text-zinc-200">{message}</p>}
            {(busy || progress.value > 0) && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4" aria-live="polite">
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-zinc-200">{progress.label}</span>
                  <span className="font-mono text-yellow-400">{progress.value}%</span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-zinc-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.value}
                >
                  <div
                    className="h-full rounded-full bg-yellow-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${progress.value}%` }}
                  />
                </div>
              </div>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setPreview(null); setMapping(null); setMessage(""); }} className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-zinc-200">Cancelar</button>
              <button type="button" disabled={busy || mapping.name < 0 || mapping.price < 0} onClick={confirmImport} className="rounded-xl bg-yellow-500 px-6 py-3 font-semibold text-black disabled:opacity-40">
                {busy ? "Importando..." : "Confirmar importación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
