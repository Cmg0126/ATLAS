import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function Navbar() {
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  const [profile]=user?(await supabase.from("profiles").select("full_name").eq("id",user.id).limit(1)).data??[]:[];
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-black px-8 text-zinc-50">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">
          ATLAS ERP
        </h1>

        <p className="text-sm text-zinc-500">
          ITLATAM GROUP S.A.S.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{profile?.full_name||user?.email||"Usuario"}</p>
          <p className="text-xs text-zinc-500">
            Administrador
          </p>
        </div>

        <form action={logout}><button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold">Salir</button></form>
      </div>
    </header>
  );
}
