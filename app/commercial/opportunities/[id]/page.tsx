import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import { createQuotation, updateOpportunity } from "../../actions";
import { getNextQuotationNumberPreview } from "../../quotation-number";
import { Field, input } from "../../ui";
import QuotationManager, { type Quotation } from "./QuotationManager";
import type { CatalogProduct } from "./ProductSearchFields";

type Opportunity = { id: string; title: string; stage: string; estimated_value: number; probability: number; expected_close_date: string | null; client_id: string; clients: { name: string } | null };
type Company = { id: string; name: string };
type Branch = { id: string; company_id: string; name: string };
export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opportunity] = await dbSelect<Opportunity>("opportunities", { select: "id,title,stage,estimated_value,probability,expected_close_date,client_id,clients(name)", id: `eq.${id}` });
  if (!opportunity) notFound();
  const [quotations, companies, branches, nextQuotationNumber, products] = await Promise.all([
    dbSelect<Quotation>("quotations", { select: "id,quotation_number,status,subtotal,discount_total,tax_total,total,validity_date,quotation_items(id,description,unit,quantity,unit_price,discount_percent,tax_percent)", opportunity_id: `eq.${id}`, order: "created_at.desc" }),
    dbSelect<Company>("companies", { select: "id,name", order: "name.asc" }),
    dbSelect<Branch>("branches", { select: "id,company_id,name", order: "name.asc" }),
    getNextQuotationNumberPreview(),
    dbSelect<CatalogProduct>("catalog_products", {
      select: "id,internal_sku,name,brand,model,unit,tax_percent,supplier_prices(id,unit_price,active,created_at,suppliers(name))",
      active: "eq.true", order: "name.asc",
    }),
  ]);
  return <AppShell>
    <div><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><p className="mt-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">{opportunity.clients?.name}</p><h1 className="mt-1 text-3xl font-bold">{opportunity.title}</h1></div>
    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Seguimiento</h2><form action={updateOpportunity} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="opportunity_id" value={id} /><Field label="Etapa"><select name="stage" defaultValue={opportunity.stage} className={input}><option value="PROSPECT">Prospecto</option><option value="QUALIFIED">Calificada</option><option value="PROPOSAL">Propuesta</option><option value="NEGOTIATION">Negociación</option><option value="WON">Ganada</option><option value="LOST">Perdida</option></select></Field><Field label="Probabilidad %"><input type="number" name="probability" min="0" max="100" defaultValue={opportunity.probability} className={input} /></Field><Field label="Valor estimado"><input type="number" name="estimated_value" min="0" defaultValue={opportunity.estimated_value} className={input} /></Field><Field label="Cierre esperado"><input type="date" name="expected_close_date" defaultValue={opportunity.expected_close_date || ""} className={input} /></Field><button className="rounded-xl bg-zinc-950 px-5 py-3 font-semibold text-white md:col-span-2">Actualizar oportunidad</button></form></section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Nueva cotización</h2><p className="mt-1 text-sm text-zinc-500">El número y el total se generan automáticamente.</p><form action={createQuotation} className="mt-5 grid gap-4 md:grid-cols-2"><input type="hidden" name="opportunity_id" value={id} /><div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4"><p className="text-sm font-semibold text-zinc-700">Próximo número</p><p className="mt-2 font-bold text-zinc-950">{nextQuotationNumber}</p><p className="mt-1 text-xs text-zinc-500">Se confirma al guardar.</p></div><Field label="Válida hasta"><input type="date" name="validity_date" className={input} /></Field><Field label="Estado"><select name="status" className={input}><option value="DRAFT">Borrador</option><option value="SENT">Enviada</option><option value="APPROVED">Aprobada</option><option value="REJECTED">Rechazada</option></select></Field><Field label="Notas"><input name="notes" className={input} placeholder="Condiciones comerciales" /></Field><button className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-black md:col-span-2">Crear cotización</button></form></section>
    </div>
    <QuotationManager opportunityId={id} opportunityTitle={opportunity.title} quotations={quotations} companies={companies} branches={branches} products={products} />
  </AppShell>;
}
