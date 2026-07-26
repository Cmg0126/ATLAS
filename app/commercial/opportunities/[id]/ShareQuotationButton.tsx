"use client";

import { useState } from "react";

export function ShareQuotationButton({ quotationId, quotationNumber }: { quotationId: string; quotationNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function share() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/commercial/quotations/${quotationId}/pdf`);
      if (!response.ok) throw new Error("No fue posible generar el PDF.");
      const blob = await response.blob();
      const file = new File([blob], `${quotationNumber}.pdf`, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: quotationNumber, text: `Adjunto cotización ${quotationNumber}.`, files: [file] });
        await fetch(`/api/commercial/quotations/${quotationId}/sent`, { method: "POST" });
        setMessage("Cotización compartida y marcada como enviada.");
        window.location.reload();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = file.name; link.click();
        URL.revokeObjectURL(url);
        setMessage("PDF descargado. Adjunta el archivo en tu correo o WhatsApp.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Envío cancelado.");
      else setMessage(error instanceof Error ? error.message : "No fue posible compartir.");
    } finally { setBusy(false); }
  }
  return <div><button type="button" onClick={share} disabled={busy} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Preparando PDF..." : "Enviar cotización"}</button>{message && <p className="mt-2 max-w-xs text-xs text-zinc-400">{message}</p>}</div>;
}
