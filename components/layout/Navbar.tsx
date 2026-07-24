export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">
          ATLAS ERP
        </h1>

        <p className="text-sm text-zinc-500">
          ITLATAM GROUP SAS
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">César Martínez</p>
          <p className="text-xs text-zinc-500">
            Administrador
          </p>
        </div>

        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
          C
        </div>
      </div>
    </header>
  );
}
