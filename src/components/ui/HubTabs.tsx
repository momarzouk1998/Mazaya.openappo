"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export interface HubTabItem {
  label: string
  icon?: string
  path: string
}

interface Props {
  tabs: HubTabItem[]
}

export default function HubTabs({ tabs }: Props) {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-2 mb-6 border-b border-gray-200/80 pb-2.5 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path || (tab.path !== "/" && pathname.startsWith(tab.path))
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              isActive
                ? "bg-brand-orange text-white shadow-md scale-[1.02]"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------
// Preset Tab Groups for easy use across pages
// ------------------------------------------------------------

export const WALLET_TABS: HubTabItem[] = [
  { label: "يومية المصنع", icon: "👛", path: "/factory-wallet" },
  { label: "يومية الألواح", icon: "🪵", path: "/boards-wallet" },
]

export const FINANCE_TABS: HubTabItem[] = [
  { label: "النثريات العامة", icon: "📄", path: "/overhead" },
  { label: "الميزانية والمركز المالي", icon: "📊", path: "/budget" },
]

export const ORDER_ADDITION_TABS: HubTabItem[] = [
  { label: "النقل الداخلي ومصاريف الطريق", icon: "🚚", path: "/internal-transport" },
  { label: "مصاريف الدهانات والمرمات", icon: "🎨", path: "/paints" },
  { label: "مصاريف الليد والكهرباء", icon: "💡", path: "/led-expenses" },
  { label: "الأعمال الخارجية للمقاولين", icon: "🔨", path: "/external-work" },
]

export const INVENTORY_TABS: HubTabItem[] = [
  { label: "مخزون الألواح", icon: "📋", path: "/boards" },
  { label: "مخزون الإكسسوارات", icon: "🔩", path: "/accessories" },
]

export const CUSTOMER_BRANCH_TABS: HubTabItem[] = [
  { label: "العملاء", icon: "👥", path: "/customers" },
  { label: "مدفوعات العملاء", icon: "💳", path: "/payments" },
  { label: "المعارض والفروع", icon: "🏪", path: "/branches" },
]

export const PARTNER_TABS: HubTabItem[] = [
  { label: "الموردين", icon: "🏭", path: "/suppliers" },
  { label: "المقاولون والورش", icon: "🔨", path: "/contractors" },
]

export const ADMIN_SETTINGS_TABS: HubTabItem[] = [
  { label: "إدارة المستخدمين والصلاحيات", icon: "⚙️", path: "/admin/users" },
  { label: "قوائم الاختيارات والخامات", icon: "🏷️", path: "/admin/material-types" },
]
