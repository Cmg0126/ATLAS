"use client";

import { Trash2 } from "lucide-react";
import { deleteReusableDocument } from "../../tenders/documents/actions";

export function DeleteDocumentButton({ documentId, companyId, name }: {
  documentId: string;
  companyId: string;
  name: string;
}) {
  return (
    <form
      action={deleteReusableDocument}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar permanentemente "${name}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="document_id" value={documentId}/>
      <input type="hidden" name="company_id" value={companyId}/>
      <button className="inline-flex items-center gap-2 rounded-xl border border-red-900 px-4 py-2 font-semibold text-red-400 hover:bg-red-950">
        <Trash2 size={16}/> Eliminar
      </button>
    </form>
  );
}
