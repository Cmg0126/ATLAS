import "server-only";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type QueryValue = string | number | boolean | null | undefined;

const getConfig = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("No autorizado");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("La sesión expiró. Inicia sesión nuevamente.");

  return {
    url: supabaseUrl.replace(/\/$/, ""),
    key: supabasePublishableKey,
    accessToken: session.access_token,
  };
};

const getHeaders = async (prefer?: string) => {
  const { key, accessToken } = await getConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
};

export async function dbSelect<T>(table: string, params: Record<string, QueryValue> = {}): Promise<T[]> {
  const { url } = await getConfig();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, { headers: await getHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase SELECT ${table}: ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

export async function dbInsert<T>(table: string, payload: unknown): Promise<T> {
  const { url } = await getConfig();
  const response = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers: await getHeaders("return=representation"), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Supabase INSERT ${table}: ${await response.text()}`);
  const rows = (await response.json()) as T[];
  return rows[0];
}

export async function dbUpsert<T>(table: string, payload: unknown, onConflict: string): Promise<T[]> {
  const { url } = await getConfig();
  const search = new URLSearchParams({ on_conflict: onConflict });
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, {
    method: "POST",
    headers: await getHeaders("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase UPSERT ${table}: ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

export async function dbUpdate(table: string, filters: Record<string, QueryValue>, payload: unknown): Promise<void> {
  const { url } = await getConfig();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null) search.set(key, String(value));
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, { method: "PATCH", headers: await getHeaders("return=representation"), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Supabase UPDATE ${table}: ${await response.text()}`);
  const rows = await response.json() as unknown[];
  if (rows.length === 0) throw new Error(`Supabase UPDATE ${table}: no se actualizó ningún registro. Verifica los permisos y vuelve a intentar.`);
}

export async function dbDelete(table: string, filters: Record<string, QueryValue>): Promise<void> {
  const { url } = await getConfig();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null) search.set(key, String(value));
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, { method: "DELETE", headers: await getHeaders() });
  if (!response.ok) throw new Error(`Supabase DELETE ${table}: ${await response.text()}`);
}
