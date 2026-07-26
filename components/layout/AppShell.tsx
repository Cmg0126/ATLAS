import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import SubmitGuard from "@/components/forms/SubmitGuard";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen bg-black text-zinc-50"><SubmitGuard /><Sidebar /><div className="min-w-0 flex-1"><Navbar /><div className="p-8">{children}</div></div></main>;
}
