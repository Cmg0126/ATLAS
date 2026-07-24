"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbInsert, dbUpdate } from "@/lib/supabase-rest";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const nullable = (value: string) => (value ? value : null);
const numberValue = (value: string) => (value ? Number(value) : 0);

export async function createProject(formData: FormData) {
  const project = await dbInsert<{ id: string }>("projects", {
    company_id: text(formData, "company_id"), branch_id: nullable(text(formData, "branch_id")), client_id: nullable(text(formData, "client_id")), manager_id: nullable(text(formData, "manager_id")), project_code: text(formData, "project_code"), name: text(formData, "name"), description: nullable(text(formData, "description")), project_type: text(formData, "project_type"), status: text(formData, "status") || "PLANNING", priority: text(formData, "priority") || "MEDIUM", start_date: nullable(text(formData, "start_date")), planned_end_date: nullable(text(formData, "planned_end_date")), contract_value: numberValue(text(formData, "contract_value")), budget_cost: numberValue(text(formData, "budget_cost")), location: nullable(text(formData, "location")),
  });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectStatus(formData: FormData) {
  const projectId = text(formData, "project_id");
  await dbUpdate("projects", { id: `eq.${projectId}` }, { status: text(formData, "status"), progress: numberValue(text(formData, "progress")), updated_at: new Date().toISOString() });
  revalidatePath(`/projects/${projectId}`); revalidatePath("/projects");
}

export async function createTask(formData: FormData) {
  const projectId = text(formData, "project_id");
  await dbInsert("project_tasks", { project_id: projectId, milestone_id: nullable(text(formData, "milestone_id")), assigned_to: nullable(text(formData, "assigned_to")), title: text(formData, "title"), description: nullable(text(formData, "description")), status: text(formData, "status") || "TODO", priority: text(formData, "priority") || "MEDIUM", start_date: nullable(text(formData, "start_date")), due_date: nullable(text(formData, "due_date")), estimated_hours: nullable(text(formData, "estimated_hours")), progress: 0 });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTask(formData: FormData) {
  const projectId = text(formData, "project_id"); const taskId = text(formData, "task_id"); const status = text(formData, "status");
  await dbUpdate("project_tasks", { id: `eq.${taskId}` }, { status, progress: numberValue(text(formData, "progress")), completed_at: status === "DONE" ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
  revalidatePath(`/projects/${projectId}`);
}

export async function createMilestone(formData: FormData) {
  const projectId = text(formData, "project_id");
  await dbInsert("project_milestones", { project_id: projectId, name: text(formData, "name"), description: nullable(text(formData, "description")), due_date: nullable(text(formData, "due_date")), status: "PENDING" });
  revalidatePath(`/projects/${projectId}`);
}

export async function createDocument(formData: FormData) {
  const projectId = text(formData, "project_id");
  await dbInsert("engineering_documents", { project_id: projectId, document_code: text(formData, "document_code"), title: text(formData, "title"), document_type: text(formData, "document_type"), discipline: nullable(text(formData, "discipline")), revision: text(formData, "revision") || "0", status: text(formData, "status") || "DRAFT", storage_path: nullable(text(formData, "storage_path")) });
  revalidatePath(`/projects/${projectId}`);
}
