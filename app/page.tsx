import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

export default function Home() {
  return (
    <main className="flex h-screen">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Navbar />

        <div className="flex-1 p-8">

          <div className="grid grid-cols-4 gap-6">

            <Card title="Clientes" value="128" />

            <Card title="Proyectos" value="23" />

            <Card title="Licitaciones" value="7" />

            <Card title="Facturación" value="$2.540M" />

          </div>

          <div className="mt-8 rounded-2xl bg-white h-[500px] shadow p-6">

            <h2 className="text-2xl font-bold">

              Bienvenido a ATLAS ERP

            </h2>

            <p className="text-zinc-500 mt-3">

              Sistema Integral de Gestión Empresarial de ITLATAM GROUP SAS

            </p>

          </div>

        </div>

      </div>

    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white shadow p-6">

      <div className="text-zinc-500">

        {title}

      </div>

      <div className="text-4xl font-bold mt-2">

        {value}

      </div>

    </div>
  );
}