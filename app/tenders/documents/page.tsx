import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { Field, input, PageTitle, primary, Section } from "../../domain-ui";
import { uploadReusableDocument } from "./actions";

type Company = { id: string; name: string };
type Document = {
  id: string; category: string; name: string; file_size: number;
  issue_date: string | null; valid_until: string | null; created_at: string;
};

const categories = [
  ["RUP", "RUP"],
  ["CAMARA_COMERCIO", "Cámara de Comercio"],
  ["CEDULA", "Cédula"],
  ["CERTIFICACION", "Certificación"],
  ["ESTADOS_FINANCIEROS", "Estados financieros"],
  ["ANTECEDENTES", "Antecedentes"],
  ["OTRO", "Otro"],
];

export default async function TenderDocumentsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const filters = await searchParams;
  const companies = await dbSelect<Company>("companies", { select: "id,name", order: "name.asc" });
  const companyId = filters.company && companies.some((company) => company.id === filters.company)
    ? filters.company : companies[0]?.id;
  const documents = companyId ? await dbSelect<Document>("reusable_tender_documents", {
    select: "id,category,name,file_size,issue_date,valid_until,created_at",
    company_id: `eq.${companyId}`,
    order: "created_at.desc",
  }) : [];

  return <AppShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageTitle domain="Contratación" title="Biblioteca de documentos habilitantes" description="Documentos reutilizables para preparar licitaciones y controlar sus vigencias." />
      <div className="flex gap-3"><Link href="/tenders/profile" className={primary}>Perfil y RUP</Link><Link href="/tenders" className="rounded-xl border px-4 py-3 font-semibold">Licitaciones</Link></div>
    </div>
    {companyId && <>
      <form method="get" className="mt-7 max-w-xl rounded-2xl border p-5">
        <Field label="Empresa"><select name="company" defaultValue={companyId} className={input}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></Field>
        <button className="mt-3 rounded-xl border px-4 py-3 font-semibold">Cambiar empresa</button>
      </form>
      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <Section title="Agregar documento">
          <form action={uploadReusableDocument} className="mt-4 space-y-4">
            <input type="hidden" name="company_id" value={companyId} />
            <Field label="Categoría"><select name="category" className={input}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Archivo"><input required type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className={input} /></Field>
            <Field label="Fecha de expedición"><input type="date" name="issue_date" className={input} /></Field>
            <Field label="Vigente hasta"><input type="date" name="valid_until" className={input} /></Field>
            <button className={`${primary} w-full`}>Guardar en la biblioteca</button>
          </form>
        </Section>
        <Section title={`Documentos guardados (${documents.length})`}>
          <div className="mt-3 divide-y">
            {documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><p className="font-bold">{document.name}</p><p className="text-sm text-zinc-500">{document.category.replaceAll("_", " ")} · {(document.file_size / 1024).toFixed(0)} KB</p><p className="text-xs text-zinc-500">Expedición: {document.issue_date || "sin fecha"} · Vigencia: {document.valid_until || "sin vencimiento"}</p></div>
              <a href={`/api/tenders/documents/${document.id}`} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-semibold">Abrir</a>
            </div>)}
            {!documents.length && <p className="py-8 text-center text-zinc-500">Todavía no hay documentos guardados.</p>}
          </div>
        </Section>
      </div>
    </>}
  </AppShell>;
}
