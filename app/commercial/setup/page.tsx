import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { createCompany } from "../actions";
import { Field, input } from "../ui";

export default function CommercialSetupPage() {
  return <AppShell><div className="mx-auto max-w-3xl"><Link href="/commercial" className="font-semibold text-orange-600">← Comercial</Link><h1 className="mt-4 text-3xl font-bold">Configuración inicial</h1><p className="mt-2 text-zinc-500">Registra la organización que utilizará ATLAS y su sede principal.</p>
    <form action={createCompany} className="mt-8 grid gap-6 rounded-2xl border bg-white p-7 shadow-sm md:grid-cols-2"><Field label="Empresa"><input name="name" required className={input} placeholder="ITLATAM GROUP SAS" /></Field><Field label="Sede principal"><input name="branch_name" required className={input} placeholder="Cartagena" /></Field><div className="flex justify-end md:col-span-2"><button className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white">Guardar y crear cliente</button></div></form>
  </div></AppShell>;
}
