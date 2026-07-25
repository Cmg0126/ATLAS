"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FolderKanban, ShoppingCart, Warehouse, FileText, Users, Shield, DollarSign, Brain, PackageSearch, Building2 } from "lucide-react";

const menu = [
  { icon: LayoutDashboard, name: "Dashboard", href: "/" },
  { icon: Briefcase, name: "Comercial", href: "/commercial" },
  { icon: Building2, name: "Empresa y documentos", href: "/commercial/setup" },
  { icon: FolderKanban, name: "Proyectos", href: "/projects" },
  { icon: FileText, name: "Licitaciones", href: "/tenders" },
  { icon: PackageSearch, name: "Catálogo y precios", href: "/catalog" },
  { icon: ShoppingCart, name: "Compras", href: "/purchasing" },
  { icon: Warehouse, name: "Inventario", href: "/inventory" },
  { icon: Users, name: "RRHH", href: "/hr" },
  { icon: Shield, name: "SST", href: "/sst" },
  { icon: DollarSign, name: "Finanzas", href: "/finance" },
  { icon: Brain, name: "Atlas AI", href: "/atlas-ai" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return <aside className="flex min-h-screen w-72 shrink-0 flex-col bg-zinc-950 text-white">
    <div className="border-b border-zinc-800 p-6"><Image src="/logo-itlatam.png" width={160} height={48} style={{ width: 160, height: "auto" }} alt="ITLATAM" priority /></div>
    <nav className="space-y-2 p-4">{menu.map(item=>{const Icon=item.icon;const active=item.href==="/"?pathname==="/":item.href==="/commercial"?pathname.startsWith("/commercial")&&!pathname.startsWith("/commercial/setup"):pathname.startsWith(item.href);return <Link key={item.name} href={item.href} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition ${active?"bg-orange-500 text-white":"text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}><Icon size={20}/>{item.name}</Link>})}</nav>
  </aside>;
}
