"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbDelete, dbInsert, dbSelect, dbUpdate } from "@/lib/supabase-rest";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (value: string) => (value ? value : null);
const amount = (value: string) => (value ? Number(value) : 0);
function required(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
}

export async function createCompany(formData: FormData) {
  const name = required(formData, "name", "La empresa");
  const [existingCompany] = await dbSelect<{ id: string }>("companies", {
    select: "id",
    name: `eq.${name}`,
    limit: 1,
  });
  const company = existingCompany ?? await dbInsert<{ id: string }>("companies", { name });
  const branchName = text(formData, "branch_name");
  if (branchName) {
    const [existingBranch] = await dbSelect<{ id: string }>("branches", {
      select: "id",
      company_id: `eq.${company.id}`,
      name: `eq.${branchName}`,
      limit: 1,
    });
    if (!existingBranch) await dbInsert("branches", { company_id: company.id, name: branchName });
  }
  revalidatePath("/commercial");
  redirect("/commercial/clients/new");
}

export async function createClient(formData: FormData) {
  const companyId = required(formData, "company_id", "La empresa");
  const name = required(formData, "name", "El nombre");
  const nit = text(formData, "nit");
  const identityFilter = nit ? { nit: `eq.${nit}` } : { name: `eq.${name}` };
  const [existingClient] = await dbSelect<{ id: string }>("clients", {
    select: "id",
    company_id: `eq.${companyId}`,
    ...identityFilter,
    limit: 1,
  });
  if (existingClient) redirect(`/commercial/clients/${existingClient.id}`);
  const client = await dbInsert<{ id: string }>("clients", {
    company_id: companyId,
    name,
    nit: nullable(nit), email: nullable(text(formData, "email")),
    phone: nullable(text(formData, "phone")), status: text(formData, "status") || "ACTIVE",
  });
  revalidatePath("/commercial");
  redirect(`/commercial/clients/${client.id}`);
}

export async function updateClient(formData: FormData) {
  const clientId = required(formData, "client_id", "El cliente");
  await dbUpdate("clients", { id: `eq.${clientId}` }, {
    name: required(formData, "name", "El nombre"), nit: nullable(text(formData, "nit")),
    email: nullable(text(formData, "email")), phone: nullable(text(formData, "phone")),
    status: text(formData, "status") || "ACTIVE",
  });
  revalidatePath("/commercial");
  revalidatePath(`/commercial/clients/${clientId}`);
}

export async function createContact(formData: FormData) {
  const clientId = required(formData, "client_id", "El cliente");
  await dbInsert("client_contacts", {
    client_id: clientId, full_name: required(formData, "full_name", "El nombre"),
    position: nullable(text(formData, "position")), email: nullable(text(formData, "email")),
    phone: nullable(text(formData, "phone")),
  });
  revalidatePath(`/commercial/clients/${clientId}`);
}

export async function createOpportunity(formData: FormData) {
  const opportunity = await dbInsert<{ id: string }>("opportunities", {
    client_id: required(formData, "client_id", "El cliente"),
    title: required(formData, "title", "El título"), stage: text(formData, "stage") || "PROSPECT",
    estimated_value: amount(text(formData, "estimated_value")),
    probability: amount(text(formData, "probability")),
    expected_close_date: nullable(text(formData, "expected_close_date")),
  });
  revalidatePath("/commercial");
  redirect(`/commercial/opportunities/${opportunity.id}`);
}

export async function updateOpportunity(formData: FormData) {
  const opportunityId = required(formData, "opportunity_id", "La oportunidad");
  await dbUpdate("opportunities", { id: `eq.${opportunityId}` }, {
    stage: required(formData, "stage", "La etapa"),
    probability: amount(text(formData, "probability")),
    estimated_value: amount(text(formData, "estimated_value")),
    expected_close_date: nullable(text(formData, "expected_close_date")),
  });
  revalidatePath("/commercial");
  revalidatePath(`/commercial/opportunities/${opportunityId}`);
}

export async function createQuotation(formData: FormData) {
  const opportunityId = required(formData, "opportunity_id", "La oportunidad");
  await dbInsert("quotations", {
    opportunity_id: opportunityId,
    quotation_number: required(formData, "quotation_number", "El número"),
    subtotal: 0, discount_total: 0, tax_total: 0, total: 0,
    validity_date: nullable(text(formData, "validity_date")),
    notes: nullable(text(formData, "notes")),
    status: text(formData, "status") || "DRAFT",
  });
  revalidatePath("/commercial");
  revalidatePath("/commercial/quotations");
  revalidatePath(`/commercial/opportunities/${opportunityId}`);
  redirect(`/commercial/opportunities/${opportunityId}`);
}

type QuotationItemAmount = {
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
};

async function recalculateQuotation(quotationId: string) {
  const items = await dbSelect<QuotationItemAmount>("quotation_items", {
    select: "quantity,unit_price,discount_percent,tax_percent",
    quotation_id: `eq.${quotationId}`,
  });
  const totals = items.reduce((result, item) => {
    const gross = Number(item.quantity) * Number(item.unit_price);
    const discount = gross * Number(item.discount_percent) / 100;
    const taxable = gross - discount;
    const tax = taxable * Number(item.tax_percent) / 100;
    result.subtotal += gross;
    result.discount_total += discount;
    result.tax_total += tax;
    result.total += taxable + tax;
    return result;
  }, { subtotal: 0, discount_total: 0, tax_total: 0, total: 0 });
  await dbUpdate("quotations", { id: `eq.${quotationId}` }, totals);
}

export async function createQuotationItem(formData: FormData) {
  const quotationId = required(formData, "quotation_id", "La cotización");
  const opportunityId = required(formData, "opportunity_id", "La oportunidad");
  await dbInsert("quotation_items", {
    quotation_id: quotationId,
    description: required(formData, "description", "La descripción"),
    unit: text(formData, "unit") || "UND",
    quantity: amount(required(formData, "quantity", "La cantidad")),
    unit_price: amount(required(formData, "unit_price", "El precio unitario")),
    discount_percent: amount(text(formData, "discount_percent")),
    tax_percent: amount(text(formData, "tax_percent")),
  });
  await recalculateQuotation(quotationId);
  revalidatePath("/commercial");
  revalidatePath("/commercial/quotations");
  revalidatePath(`/commercial/opportunities/${opportunityId}`);
}

export async function deleteQuotationItem(formData: FormData) {
  const itemId = required(formData, "item_id", "El ítem");
  const quotationId = required(formData, "quotation_id", "La cotización");
  const opportunityId = required(formData, "opportunity_id", "La oportunidad");
  await dbDelete("quotation_items", { id: `eq.${itemId}`, quotation_id: `eq.${quotationId}` });
  await recalculateQuotation(quotationId);
  revalidatePath("/commercial");
  revalidatePath("/commercial/quotations");
  revalidatePath(`/commercial/opportunities/${opportunityId}`);
}

export async function updateQuotationStatus(formData: FormData) {
  const quotationId = required(formData, "quotation_id", "La cotización");
  const opportunityId = required(formData, "opportunity_id", "La oportunidad");
  await dbUpdate("quotations", { id: `eq.${quotationId}` }, { status: required(formData, "status", "El estado") });
  revalidatePath("/commercial");
  revalidatePath("/commercial/quotations");
  revalidatePath(`/commercial/opportunities/${opportunityId}`);
}

type ConversionQuote = {
  id: string; quotation_number: string | null; total: number; status: string;
  opportunity_id: string; opportunities: { client_id: string; title: string } | null;
};

export async function convertQuotationToProject(formData: FormData) {
  const quotationId = required(formData, "quotation_id", "La cotización");
  const [quotation] = await dbSelect<ConversionQuote>("quotations", {
    select: "id,quotation_number,total,status,opportunity_id,opportunities(client_id,title)",
    id: `eq.${quotationId}`,
  });
  if (!quotation) throw new Error("La cotización no existe.");
  if (quotation.status !== "APPROVED") throw new Error("Solo una cotización aprobada se puede convertir.");
  if (!quotation.opportunities) throw new Error("La oportunidad no existe.");
  const existing = await dbSelect<{ id: string }>("projects", { select: "id", quotation_id: `eq.${quotationId}`, limit: 1 });
  if (existing[0]) redirect(`/projects/${existing[0].id}`);
  const project = await dbInsert<{ id: string }>("projects", {
    company_id: required(formData, "company_id", "La empresa"),
    branch_id: nullable(text(formData, "branch_id")), client_id: quotation.opportunities.client_id,
    opportunity_id: quotation.opportunity_id, quotation_id: quotation.id,
    project_code: required(formData, "project_code", "El código"),
    name: text(formData, "name") || quotation.opportunities.title,
    project_type: required(formData, "project_type", "El tipo"), status: "PLANNING",
    priority: text(formData, "priority") || "MEDIUM", contract_value: Number(quotation.total || 0),
    budget_cost: amount(text(formData, "budget_cost")), progress: 0,
    location: nullable(text(formData, "location")),
  });
  await dbUpdate("opportunities", { id: `eq.${quotation.opportunity_id}` }, { stage: "WON", probability: 100 });
  revalidatePath("/commercial");
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
