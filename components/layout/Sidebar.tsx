"use client";

import {
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  ShoppingCart,
  Warehouse,
  FileText,
  Users,
  Shield,
  DollarSign,
  Brain,
} from "lucide-react";

const menu = [
  { icon: LayoutDashboard, name: "Dashboard" },
  { icon: Briefcase, name: "Comercial" },
  { icon: FolderKanban, name: "Proyectos" },
  { icon: FileText, name: "Licitaciones" },
  { icon: ShoppingCart, name: "Compras" },
  { icon: Warehouse, name: "Inventario" },
  { icon: Users, name: "RRHH" },
  { icon: Shield, name: "SST" },
  { icon: DollarSign, name: "Finanzas" },
  { icon: Brain, name: "Atlas AI" },
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-zinc-950 text-white flex flex-col">

      <div className="p-6 border-b border-zinc-800">

        <img
          src="/logo-itlatam.png"
          className="w-40"
          alt="logo"
        />

      </div>

      <div className="p-4 space-y-2">

        {menu.map((item) => {

          const Icon = item.icon;

          return (

            <button
              key={item.name}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 hover:bg-orange-500 transition"
            >

              <Icon size={20} />

              {item.name}

            </button>

          );

        })}

      </div>

    </aside>
  );
}