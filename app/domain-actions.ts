"use server";

import { revalidatePath } from "next/cache";
import { dbInsert, dbSelect, dbUpdate } from "@/lib/supabase-rest";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const nullable = (value: string) => value || null;
const number = (value: string) => value ? Number(value) : 0;
const required = (data: FormData, key: string, label: string) => {
  const value = text(data, key);
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
};
const refresh = (...paths: string[]) => paths.forEach((path) => revalidatePath(path));

export async function createTender(data: FormData) {
  await dbInsert("tenders", {
    company_id: required(data, "company_id", "La empresa"), client_id: nullable(text(data, "client_id")),
    code: required(data, "code", "El código"), title: required(data, "title", "El título"),
    entity: nullable(text(data, "entity")), status: text(data, "status") || "DRAFT",
    submission_date: nullable(text(data, "submission_date")), estimated_value: number(text(data, "estimated_value")),
    description: nullable(text(data, "description")),
  });
  refresh("/tenders");
}
export async function updateTender(data: FormData) {
  const id = required(data, "tender_id", "La licitación");
  await dbUpdate("tenders", { id: `eq.${id}` }, { status: required(data, "status", "El estado"), updated_at: new Date().toISOString() });
  refresh("/tenders");
}
export async function createTenderRequirement(data: FormData) {
  await dbInsert("tender_requirements", {
    tender_id: required(data, "tender_id", "La licitación"), title: required(data, "title", "El requisito"),
    responsible: nullable(text(data, "responsible")), due_date: nullable(text(data, "due_date")),
    status: text(data, "status") || "PENDING",
  });
  refresh("/tenders");
}

export async function createSupplier(data: FormData) {
  await dbInsert("suppliers", {
    company_id: required(data, "company_id", "La empresa"), name: required(data, "name", "El proveedor"),
    nit: nullable(text(data, "nit")), email: nullable(text(data, "email")), phone: nullable(text(data, "phone")), status: "ACTIVE",
  });
  refresh("/purchasing");
}
export async function createPurchaseOrder(data: FormData) {
  await dbInsert("purchase_orders", {
    company_id: required(data, "company_id", "La empresa"), supplier_id: nullable(text(data, "supplier_id")),
    project_id: nullable(text(data, "project_id")), order_number: required(data, "order_number", "El número"),
    status: text(data, "status") || "DRAFT", issue_date: text(data, "issue_date") || new Date().toISOString().slice(0, 10),
    expected_date: nullable(text(data, "expected_date")), total: number(text(data, "total")), notes: nullable(text(data, "notes")),
  });
  refresh("/purchasing");
}
export async function updatePurchaseOrder(data: FormData) {
  const id = required(data, "purchase_order_id", "La orden");
  await dbUpdate("purchase_orders", { id: `eq.${id}` }, { status: required(data, "status", "El estado"), updated_at: new Date().toISOString() });
  refresh("/purchasing");
}
export async function createPurchaseOrderItem(data: FormData) {
  const orderId = required(data, "purchase_order_id", "La orden");
  await dbInsert("purchase_order_items", {
    purchase_order_id: orderId, description: required(data, "description", "La descripción"),
    quantity: number(text(data, "quantity")) || 1, unit_cost: number(text(data, "unit_cost")),
  });
  const items = await dbSelect<{ quantity: number; unit_cost: number }>("purchase_order_items", { select: "quantity,unit_cost", purchase_order_id: `eq.${orderId}` });
  await dbUpdate("purchase_orders", { id: `eq.${orderId}` }, {
    total: items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0),
    updated_at: new Date().toISOString(),
  });
  refresh("/purchasing");
}

export async function createInventoryItem(data: FormData) {
  await dbInsert("inventory_items", {
    company_id: required(data, "company_id", "La empresa"), sku: required(data, "sku", "El SKU"),
    name: required(data, "name", "El nombre"), category: nullable(text(data, "category")),
    unit: text(data, "unit") || "UND", current_stock: number(text(data, "current_stock")),
    min_stock: number(text(data, "min_stock")), unit_cost: number(text(data, "unit_cost")),
  });
  refresh("/inventory");
}
export async function createInventoryMovement(data: FormData) {
  const itemId = required(data, "item_id", "El artículo");
  const movementType = required(data, "movement_type", "El tipo");
  const quantity = number(required(data, "quantity", "La cantidad"));
  if (quantity <= 0) throw new Error("La cantidad debe ser mayor que cero.");
  const [item] = await dbSelect<{ company_id: string; current_stock: number }>("inventory_items", { select: "company_id,current_stock", id: `eq.${itemId}` });
  if (!item) throw new Error("El artículo no existe.");
  const delta = movementType === "OUT" ? -quantity : quantity;
  const nextStock = Number(item.current_stock) + delta;
  if (nextStock < 0) throw new Error("La salida supera la existencia disponible.");
  await dbInsert("inventory_movements", {
    company_id: item.company_id, item_id: itemId, project_id: nullable(text(data, "project_id")),
    movement_type: movementType, quantity, reference: nullable(text(data, "reference")), notes: nullable(text(data, "notes")),
  });
  await dbUpdate("inventory_items", { id: `eq.${itemId}` }, { current_stock: nextStock, updated_at: new Date().toISOString() });
  refresh("/inventory");
}

export async function createEmployee(data: FormData) {
  await dbInsert("employees", {
    company_id: required(data, "company_id", "La empresa"), branch_id: nullable(text(data, "branch_id")),
    employee_code: required(data, "employee_code", "El código"), full_name: required(data, "full_name", "El nombre"),
    document_number: nullable(text(data, "document_number")), email: nullable(text(data, "email")),
    phone: nullable(text(data, "phone")), position: nullable(text(data, "position")),
    department: nullable(text(data, "department")), status: "ACTIVE", hire_date: nullable(text(data, "hire_date")),
    contract_type: text(data, "contract_type") || "PAYROLL",
    contract_start_date: nullable(text(data, "contract_start_date")),
    contract_end_date: nullable(text(data, "contract_end_date")),
  });
  refresh("/hr");
}
export async function updateEmployeeContract(data: FormData) {
  const id = required(data, "employee_id", "El empleado");
  await dbUpdate("employees", { id: `eq.${id}` }, {
    contract_type: required(data, "contract_type", "El tipo de contrato"),
    contract_start_date: nullable(text(data, "contract_start_date")),
    contract_end_date: nullable(text(data, "contract_end_date")),
    status: required(data, "status", "El estado"),
    updated_at: new Date().toISOString(),
  });
  refresh("/hr");
}
export async function createLeaveRequest(data: FormData) {
  await dbInsert("leave_requests", {
    employee_id: required(data, "employee_id", "El empleado"), request_type: required(data, "request_type", "El tipo"),
    start_date: required(data, "start_date", "La fecha inicial"), end_date: required(data, "end_date", "La fecha final"),
    status: "PENDING", notes: nullable(text(data, "notes")),
  });
  refresh("/hr");
}
export async function updateLeaveRequest(data: FormData) {
  await dbUpdate("leave_requests", { id: `eq.${required(data, "leave_id", "La solicitud")}` }, { status: required(data, "status", "El estado") });
  refresh("/hr");
}

export async function createSubcontractor(data: FormData) {
  await dbInsert("subcontractors", {
    company_id: required(data, "company_id", "La empresa"),
    party_type: text(data, "party_type") || "COMPANY",
    name: required(data, "name", "El nombre"),
    document_number: nullable(text(data, "document_number")),
    contact_name: nullable(text(data, "contact_name")),
    email: nullable(text(data, "email")),
    phone: nullable(text(data, "phone")),
    specialty: nullable(text(data, "specialty")),
    status: "ACTIVE",
  });
  refresh("/hr");
}

export async function createSubcontractorContract(data: FormData) {
  await dbInsert("subcontractor_contracts", {
    subcontractor_id: required(data, "subcontractor_id", "El subcontratista"),
    project_id: nullable(text(data, "project_id")),
    contract_number: required(data, "contract_number", "El número"),
    contract_type: text(data, "contract_type") || "SUBCONTRACT",
    scope: required(data, "scope", "El alcance"),
    start_date: nullable(text(data, "start_date")),
    end_date: nullable(text(data, "end_date")),
    contract_value: number(text(data, "contract_value")),
    status: text(data, "status") || "DRAFT",
  });
  refresh("/hr");
}

export async function updateSubcontractorContract(data: FormData) {
  const id = required(data, "subcontractor_contract_id", "El contrato");
  await dbUpdate("subcontractor_contracts", { id: `eq.${id}` }, {
    status: required(data, "status", "El estado"),
    updated_at: new Date().toISOString(),
  });
  refresh("/hr");
}

export async function createSstIncident(data: FormData) {
  await dbInsert("sst_incidents", {
    company_id: required(data, "company_id", "La empresa"), employee_id: nullable(text(data, "employee_id")),
    project_id: nullable(text(data, "project_id")), incident_date: required(data, "incident_date", "La fecha"),
    incident_type: required(data, "incident_type", "El tipo"), severity: text(data, "severity") || "LOW",
    status: "OPEN", description: required(data, "description", "La descripción"),
    corrective_action: nullable(text(data, "corrective_action")),
  });
  refresh("/sst");
}
export async function updateSstIncident(data: FormData) {
  await dbUpdate("sst_incidents", { id: `eq.${required(data, "incident_id", "El incidente")}` }, {
    status: required(data, "status", "El estado"), corrective_action: nullable(text(data, "corrective_action")),
    updated_at: new Date().toISOString(),
  });
  refresh("/sst");
}
export async function createSstInspection(data: FormData) {
  await dbInsert("sst_inspections", {
    company_id: required(data, "company_id", "La empresa"), project_id: nullable(text(data, "project_id")),
    inspection_date: required(data, "inspection_date", "La fecha"),
    inspection_type: required(data, "inspection_type", "El tipo"), result: text(data, "result") || "PENDING",
    inspector: nullable(text(data, "inspector")), findings: nullable(text(data, "findings")),
  });
  refresh("/sst");
}

export async function createInvoice(data: FormData) {
  await dbInsert("invoices", {
    company_id: required(data, "company_id", "La empresa"), client_id: nullable(text(data, "client_id")),
    project_id: nullable(text(data, "project_id")), invoice_number: required(data, "invoice_number", "El número"),
    invoice_type: text(data, "invoice_type") || "SALE", status: text(data, "status") || "DRAFT",
    issue_date: text(data, "issue_date") || new Date().toISOString().slice(0, 10),
    due_date: nullable(text(data, "due_date")), total: number(text(data, "total")), paid_amount: 0,
  });
  refresh("/finance");
}
export async function updateInvoice(data: FormData) {
  await dbUpdate("invoices", { id: `eq.${required(data, "invoice_id", "La factura")}` }, {
    status: required(data, "status", "El estado"), paid_amount: number(text(data, "paid_amount")),
    updated_at: new Date().toISOString(),
  });
  refresh("/finance");
}
export async function createFinanceTransaction(data: FormData) {
  await dbInsert("finance_transactions", {
    company_id: required(data, "company_id", "La empresa"), project_id: nullable(text(data, "project_id")),
    transaction_type: required(data, "transaction_type", "El tipo"), category: nullable(text(data, "category")),
    description: required(data, "description", "La descripción"), amount: number(required(data, "amount", "El valor")),
    transaction_date: text(data, "transaction_date") || new Date().toISOString().slice(0, 10), status: "POSTED",
  });
  refresh("/finance");
}

export async function createAiDraft(data: FormData) {
  const requestType = required(data, "request_type", "El tipo");
  const prompt = required(data, "prompt", "La instrucción");
  const projectId = nullable(text(data, "project_id"));
  const projectName = projectId
    ? (await dbSelect<{ name: string }>("projects", { select: "name", id: `eq.${projectId}` }))[0]?.name
    : null;
  const output = [
    `BORRADOR — ${requestType.toUpperCase()}`,
    projectName ? `Proyecto: ${projectName}` : null,
    "",
    "Objetivo",
    prompt,
    "",
    "Alcance propuesto",
    "1. Revisar antecedentes, requisitos contractuales y normativa aplicable.",
    "2. Documentar criterios técnicos, responsables, recursos y entregables.",
    "3. Validar el contenido con el profesional responsable antes de emitirlo.",
    "",
    "Nota: borrador estructural generado por ATLAS; requiere revisión técnica.",
  ].filter((line) => line !== null).join("\n");
  await dbInsert("ai_requests", {
    company_id: required(data, "company_id", "La empresa"), project_id: projectId,
    request_type: requestType, prompt, status: "COMPLETED", output,
  });
  refresh("/atlas-ai");
}
