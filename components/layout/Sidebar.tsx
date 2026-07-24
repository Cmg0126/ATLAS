"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FolderKanban, ShoppingCart, Warehouse, FileText, Users, Shield, DollarSign, Brain } from "lucide-react";

const menu = [
  { icon: LayoutDashboard, name: "Dashboard", href: "/" },
  { icon: Briefcase, name: "Comercial", href: "/commercial" },
  { icon: FolderKanban, name: "Proyectos", href: "/projects" },
  { icon: FileText, name: "Licitaciones", href: "/tenders" },
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
    <div className="border-b border-zinc-800 p-6"><img src="/logo-itlatam.png" className="w-40" alt="ITLATAM" /></div>
    <nav className="space-y-2 p-4">{menu.map(item=>{const Icon=item.icon;const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <Link key={item.name} href={item.href} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition ${active?"bg-orange-500 text-white":"text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}><Icon size={20}/>{item.name}</Link>})}</nav>
  </aside>;
}
