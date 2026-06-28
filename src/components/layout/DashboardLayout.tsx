"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/ui/Logo";
import { ALL_MODULES, type CurrentProfile } from "@/lib/auth";

interface Props { profile: CurrentProfile; children: React.ReactNode; }

export default function DashboardLayout({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visible = profile.role === 'admin' ? ALL_MODULES : ALL_MODULES.filter(m => profile.visible_modules.includes(m.key));
  const isActive = (item: typeof ALL_MODULES[number]) => {
    const p = (item as any).path || `/${item.key}`;
    return pathname === p || pathname.startsWith(p + "/");
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 right-0 h-screen w-64 bg-brand-black text-white z-40 transition-transform flex flex-col ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-white/10 shrink-0">
          <div className="bg-white rounded-lg p-2 inline-block">
            <Logo size={32} withText={false} />
          </div>
          <div className="mt-3 text-xs text-white/60">لوحة الإدارة</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visible.map(m => (
            <Link
              key={m.key}
              href={(m as any).path || `/${m.key}`}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm shrink-0 ${
                isActive(m)
                  ? "bg-brand-orange text-white font-semibold shadow-md"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              <span>{m.label}</span>
            </Link>
          ))}
        </nav>
        <div className="shrink-0 p-3 border-t border-white/10 bg-brand-black">
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className="block px-3 py-2 text-sm text-white/90 hover:bg-white/5 rounded-lg transition"
          >
            <div className="font-semibold text-white">{profile.username}</div>
            <div className="text-white/60">{profile.role === "admin" ? "مدير المصنع" : "موظف"}</div>
          </Link>
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className="w-full text-right px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white rounded-lg transition flex items-center gap-2"
          >
            👤 الملف الشخصي
          </Link>
          <button onClick={logout} className="w-full text-right px-3 py-2 text-sm text-red-300 hover:bg-white/5 rounded-lg transition">
            🚪 تسجيل الخروج
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition text-sm"
              title="الملف الشخصي"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-brand-orange-dark flex items-center justify-center text-white font-bold text-sm">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-right leading-tight">
                <div className="text-xs text-gray-500">مرحباً</div>
                <div className="font-semibold text-brand-black text-sm">{profile.username}</div>
              </div>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
