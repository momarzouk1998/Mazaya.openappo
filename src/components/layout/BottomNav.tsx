"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/store/user-store";

// شريط تنقّل سفلي للموبايل — إضافي بالكامل، مايستبدلش الدرج الجانبي.
// الديسكتوب (lg+) مايشوفوش. الصفحات غير الموجودة هنا تفضل من الدرج.
const ITEMS = [
  { key: "journal", label: "الرئيسية", icon: "🏠", path: "/journal" },
  { key: "wallets", label: "اليوميات", icon: "💰", path: "/wallets" },
  { key: "orders", label: "الأوردرات", icon: "📦", path: "/orders" },
  { key: "workers", label: "العمال", icon: "🧑‍🔧", path: "/workers" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user: profile } = useUserStore();

  if (!profile) return null;

  // نحترم صلاحيات المستخدم — لو مش متعلّم على موديول، مايظهرش في الشريط
  const items = ITEMS.filter((it) => profile.visible_modules.includes(it.key));
  if (items.length === 0) return null;

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 flex items-stretch justify-around"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="تنقّل سريع"
    >
      {items.map((it) => {
        const active = isActive(it.path);
        return (
          <Link
            key={it.key}
            href={it.path}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2 text-[11px] font-medium transition-colors ${
              active ? "text-brand-orange" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className={`text-xl leading-none ${active ? "" : "opacity-70"}`}>{it.icon}</span>
            <span className="truncate max-w-full">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
