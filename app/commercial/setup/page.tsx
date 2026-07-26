import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { CompanySettings } from "./CompanySettings";

export default function CommercialSetupPage() {
  return <AppShell><div className="mx-auto max-w-7xl">
    <Link href="/commercial" className="font-semibold text-yellow-500">← Comercial</Link>
    <h1 className="mt-4 text-3xl font-bold">Configuración de la empresa</h1>
    <p className="mt-2 text-zinc-400">Información legal, tributaria, financiera y administrativa utilizada por todos los dominios de ATLAS.</p>
    <CompanySettings/>
  </div></AppShell>;
}
