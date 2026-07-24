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
    inventory_item_id: nullable(text(data, "inventory_item_id")),
    quantity: number(text(data, "quantity")) || 1, unit_cost: number(text(data, "unit_cost")),
  });
  const items = await dbSelect<{ quantity: number; unit_cost: number }>("purchase_order_items", { select: "quantity,unit_cost", purchase_order_id: `eq.${orderId}` });
  await dbUpdate("purchase_orders", { id: `eq.${orderId}` }, {
    total: items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0),
    updated_at: new Date().toISOString(),
  });
  refresh("/purchasing");
}

export async function receivePurchaseOrderItem(data: FormData) {
  const orderId = required(data, "purchase_order_id", "La orden");
  const orderItemId = required(data, "purchase_order_item_id", "La partida");
  const receiveQuantity = number(required(data, "receive_quantity", "La cantidad recibida"));
  if (receiveQuantity <= 0) throw new Error("La cantidad recibida debe ser mayor que cero.");

  const [order] = await dbSelect<{ company_id: string; order_number: string; project_id: string | null; status: string }>("purchase_orders", {
    select: "company_id,order_number,project_id,status", id: `eq.${orderId}`,
  });
  if (!order || order.status === "CANCELLED") throw new Error("La orden no está disponible para recepción.");
  const [orderItem] = await dbSelect<{ inventory_item_id: string | null; quantity: number; received_quantity: number; unit_cost: number }>("purchase_order_items", {
    select: "inventory_item_id,quantity,received_quantity,unit_cost", id: `eq.${orderItemId}`, purchase_order_id: `eq.${orderId}`,
  });
  if (!orderItem?.inventory_item_id) throw new Error("La partida debe estar vinculada a un artículo de inventario.");
  const pending = Number(orderItem.quantity) - Number(orderItem.received_quantity);
  if (receiveQuantity > pending) throw new Error(`Solo quedan ${pending} unidades pendientes.`);

  const [inventoryItem] = await dbSelect<{ current_stock: number }>("inventory_items", {
    select: "current_stock", id: `eq.${orderItem.inventory_item_id}`,
  });
  if (!inventoryItem) throw new Error("El artículo de inventario no existe.");

  await dbInsert("inventory_movements", {
    company_id: order.company_id, item_id: orderItem.inventory_item_id, project_id: order.project_id,
    movement_type: "IN", quantity: receiveQuantity, reference: `OC ${order.order_number}`,
    notes: "Recepción de orden de compra",
  });
  await dbUpdate("inventory_items", { id: `eq.${orderItem.inventory_item_id}` }, {
    current_stock: Number(inventoryItem.current_stock) + receiveQuantity,
    unit_cost: Number(orderItem.unit_cost),
    updated_at: new Date().toISOString(),
  });
  await dbUpdate("purchase_order_items", { id: `eq.${orderItemId}` }, {
    received_quantity: Number(orderItem.received_quantity) + receiveQuantity,
  });

  const items = await dbSelect<{ quantity: number; received_quantity: number }>("purchase_order_items", {
    select: "quantity,received_quantity", purchase_order_id: `eq.${orderId}`,
  });
  const received = items.reduce((sum, item) => sum + Number(item.received_quantity), 0);
  const ordered = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  await dbUpdate("purchase_orders", { id: `eq.${orderId}` }, {
    status: received >= ordered ? "RECEIVED" : "PARTIAL",
    updated_at: new Date().toISOString(),
  });
  refresh("/purchasing", "/inventory");
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

export async function createEmployeePaymentItem(data: FormData) {
  await dbInsert("employee_payment_items", {
    employee_id: required(data, "employee_id", "El empleado"),
    code: required(data, "code", "El código"),
    name: required(data, "name", "El concepto"),
    base_amount: number(text(data, "base_amount")),
    rate: number(text(data, "rate")),
    calculation_type: text(data, "calculation_type") || "PERCENTAGE",
    fixed_amount: number(text(data, "fixed_amount")),
    payment_method: text(data, "payment_method") || "BANK_TRANSFER",
    beneficiary: nullable(text(data, "beneficiary")),
    is_enabled: true,
  });
  refresh("/hr/payroll");
}

export async function liquidateEmployeePaymentItem(data: FormData) {
  const itemId = required(data, "payment_item_id", "El concepto");
  const [item] = await dbSelect<{employee_id:string;base_amount:number;rate:number;calculation_type:string;fixed_amount:number;payment_method:string;name:string;employees:{company_id:string}|null}>("employee_payment_items", {
    select: "employee_id,base_amount,rate,calculation_type,fixed_amount,payment_method,name,employees(company_id)",
    id: `eq.${itemId}`,
  });
  if (!item?.employees) throw new Error("El concepto no existe.");
  const amount = item.calculation_type === "FIXED" ? Number(item.fixed_amount) : Number(item.base_amount) * Number(item.rate) / 100;
  const status = text(data, "status") || "PENDING";
  const payment = await dbInsert<{id:string}>("employee_payments", {
    company_id: item.employees.company_id, employee_id: item.employee_id, payment_item_id: itemId,
    payment_type: item.name, period_start: nullable(text(data, "period_start")), period_end: nullable(text(data, "period_end")),
    base_amount: item.base_amount, rate: item.rate, amount, payment_method: item.payment_method,
    status, paid_at: status === "PAID" ? new Date().toISOString() : null,
    reference: nullable(text(data, "reference")),
  });
  if (status === "PAID") await dbInsert("finance_transactions", {
    company_id: item.employees.company_id, employee_payment_id: payment.id, transaction_type: "EXPENSE",
    category: "PERSONAL", description: `Pago ${item.name}`, amount,
    transaction_date: new Date().toISOString().slice(0, 10), status: "POSTED",
  });
  refresh("/hr/payroll", "/finance");
}

export async function liquidatePayrollEmployee(data: FormData) {
  const employeeId = required(data, "employee_id", "El empleado");
  const [employee] = await dbSelect<{company_id:string;contract_type:string;base_salary:number}>("employees", {select:"company_id,contract_type,base_salary",id:`eq.${employeeId}`});
  if (!employee || employee.contract_type !== "PAYROLL") throw new Error("El empleado no pertenece a nómina.");
  const salary = number(text(data, "base_salary")) || Number(employee.base_salary);
  const status = text(data, "status") || "PENDING";
  await dbUpdate("employees", {id:`eq.${employeeId}`}, {base_salary:salary,updated_at:new Date().toISOString()});
  const payment = await dbInsert<{id:string}>("employee_payments", {
    company_id:employee.company_id,employee_id:employeeId,payment_item_id:null,payment_type:"NÓMINA",
    period_start:required(data,"period_start","El inicio"),period_end:required(data,"period_end","El final"),
    base_amount:salary,rate:100,amount:salary,payment_method:text(data,"payment_method")||"BANK_TRANSFER",
    status,paid_at:status==="PAID"?new Date().toISOString():null,
    reference:nullable(text(data,"reference")),
  });
  if (status === "PAID") await dbInsert("finance_transactions", {
    company_id: employee.company_id, employee_payment_id: payment.id, transaction_type: "EXPENSE",
    category: "NÓMINA", description: "Pago de nómina", amount: salary,
    transaction_date: new Date().toISOString().slice(0, 10), status: "POSTED",
  });
  refresh("/hr/payroll", "/finance");
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
  const invoiceId = required(data, "invoice_id", "La factura");
  const [invoice] = await dbSelect<{company_id:string;project_id:string|null;invoice_number:string;invoice_type:string;paid_amount:number;total:number}>("invoices", {
    select: "company_id,project_id,invoice_number,invoice_type,paid_amount,total", id: `eq.${invoiceId}`,
  });
  if (!invoice) throw new Error("La factura no existe.");
  const paidAmount = number(text(data, "paid_amount"));
  if (paidAmount < 0 || paidAmount > Number(invoice.total)) throw new Error("El valor pagado debe estar entre cero y el total.");
  const delta = paidAmount - Number(invoice.paid_amount);
  const requestedStatus = required(data, "status", "El estado");
  const status = requestedStatus === "VOID" ? "VOID" : paidAmount >= Number(invoice.total) ? "PAID" : paidAmount > 0 ? "PARTIAL" : requestedStatus;
  await dbUpdate("invoices", { id: `eq.${invoiceId}` }, {
    status, paid_amount: paidAmount,
    updated_at: new Date().toISOString(),
  });
  if (delta > 0) await dbInsert("finance_transactions", {
    company_id: invoice.company_id, project_id: invoice.project_id, invoice_id: invoiceId,
    transaction_type: invoice.invoice_type === "PURCHASE" ? "EXPENSE" : "INCOME",
    category: invoice.invoice_type === "PURCHASE" ? "CUENTAS POR PAGAR" : "CARTERA",
    description: `Pago factura ${invoice.invoice_number}`, amount: delta,
    transaction_date: new Date().toISOString().slice(0, 10), status: "POSTED",
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
