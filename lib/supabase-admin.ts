import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/config";

const getAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export async function adminSelect<T>(table: string, columns = "*", filters: Record<string, string> = {}): Promise<T[]> {
  let query = getAdminClient().from(table).select(columns);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase ADMIN SELECT ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function adminInsert<T>(table: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await getAdminClient().from(table).insert(payload).select().single();
  if (error) throw new Error(`Supabase ADMIN INSERT ${table}: ${error.message}`);
  return data as T;
}
