"use server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { dbInsert, dbSelect } from "@/lib/supabase-rest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";

export async function createFirstAdmin(data: FormData) {
  const email=String(data.get("email")??"").trim(), password=String(data.get("password")??""), fullName=String(data.get("full_name")??"").trim();
  if(password.length<10) redirect("/setup-admin?error=La contraseña debe tener al menos 10 caracteres");
  const admin=createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:list}=await admin.auth.admin.listUsers({page:1,perPage:1});
  if(list.users.length) redirect("/login?error=El administrador inicial ya fue configurado");
  const [company]=await dbSelect<{id:string}>("companies",{select:"id",limit:1});
  if(!company) throw new Error("No existe una empresa configurada.");
  let [role]=await dbSelect<{id:string}>("roles",{select:"id",name:"eq.ADMIN",limit:1});
  if(!role) role=await dbInsert<{id:string}>("roles",{name:"ADMIN",description:"Administrador general"});
  const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName}});
  if(error||!created.user) redirect(`/setup-admin?error=${encodeURIComponent(error?.message??"No se pudo crear el usuario")}`);
  await dbInsert("profiles",{id:created.user.id,company_id:company.id,role_id:role.id,full_name:fullName,email,is_active:true});
  const supabase=await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({email,password});
  redirect("/");
}
