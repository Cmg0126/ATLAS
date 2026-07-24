type QueryValue = string | number | boolean | null | undefined;

const getConfig = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return { url: url.replace(/\/$/, ""), key };
};

const headers = (prefer?: string) => {
  const { key } = getConfig();
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
};

export async function dbSelect<T>(table: string, params: Record<string, QueryValue> = {}): Promise<T[]> {
  const { url } = getConfig();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase SELECT ${table}: ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

export async function dbInsert<T>(table: string, payload: unknown): Promise<T> {
  const { url } = getConfig();
  const response = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers: headers("return=representation"), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Supabase INSERT ${table}: ${await response.text()}`);
  const rows = (await response.json()) as T[];
  return rows[0];
}

export async function dbUpdate(table: string, filters: Record<string, QueryValue>, payload: unknown): Promise<void> {
  const { url } = getConfig();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null) search.set(key, String(value));
  const response = await fetch(`${url}/rest/v1/${table}?${search.toString()}`, { method: "PATCH", headers: headers(), body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Supabase UPDATE ${table}: ${await response.text()}`);
}
