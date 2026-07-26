"use client";

import { useEffect } from "react";

export default function SubmitGuard() {
  useEffect(() => {
    const handleSubmit = (event: SubmitEvent) => {
      const button = event.submitter;
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.submitting === "true") {
        event.preventDefault();
        return;
      }
      button.dataset.submitting = "true";
      button.dataset.originalText = button.textContent ?? "";
      button.disabled = true;
      button.textContent = "Guardando…";
      window.setTimeout(() => {
        if (!button.isConnected) return;
        button.disabled = false;
        button.textContent = button.dataset.originalText ?? "Guardar";
        delete button.dataset.submitting;
      }, 5000);
    };
    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);
  return null;
}
