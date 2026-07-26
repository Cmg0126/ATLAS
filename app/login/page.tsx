import Image from "next/image";
import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-yellow-500/5">
      <div className="flex justify-center">
        <Image src="/logo-itlatam.png" width={500} height={250} className="h-auto w-64" alt="ITLATAM Group SAS" priority />
      </div>
      <p className="mt-5 text-center text-sm font-bold uppercase tracking-[0.28em] text-orange-500">ATLAS ERP</p>
      <h1 className="mt-3 text-center text-3xl font-bold">Iniciar sesión</h1>
      <p className="mt-2 text-center text-zinc-400">Acceso seguro a ITLATAM GROUP S.A.S.</p>
      {error && <p className="mt-4 rounded-xl bg-red-950 p-3 text-sm text-red-200">{error}</p>}
      <form action={login} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold">Correo<input required type="email" name="email" className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-orange-500" /></label>
        <label className="block text-sm font-semibold">Contraseña<input required type="password" name="password" className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-orange-500" /></label>
        <button className="w-full rounded-xl bg-orange-500 px-5 py-3 font-bold text-black transition hover:brightness-110">Entrar</button>
      </form>
      <Link href="/setup-admin" className="mt-5 block text-center text-sm text-zinc-400 transition hover:text-orange-500">Configurar primer administrador</Link>
    </div>
  </main>;
}
