"use client";

import { deleteQuotation } from "../actions";

export function DeleteQuotationButton({
  quotationId,
  opportunityId,
  compact = false,
}: {
  quotationId: string;
  opportunityId: string;
  compact?: boolean;
}) {
  return <form
    action={deleteQuotation}
    onSubmit={(event) => {
      if (!window.confirm("¿Eliminar esta cotización y todas sus partidas? Esta acción no se puede deshacer.")) {
        event.preventDefault();
      }
    }}
  >
    <input type="hidden" name="quotation_id" value={quotationId} />
    <input type="hidden" name="opportunity_id" value={opportunityId} />
    <button className={compact
      ? "font-semibold text-red-400 hover:text-red-300"
      : "rounded-xl border border-red-900 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/70"}>
      Eliminar
    </button>
  </form>;
}
