import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen bg-zinc-100"><Sidebar /><div className="min-w-0 flex-1"><Navbar /><div className="p-8">{children}</div></div></main>;
}
