"use client"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/Button"

export default function InventoryHubPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()

  if (!profile) return null

  const items = [
    {
      title: "مخزون الألواح",
      desc: "إدارة أنواع الألواح، الكميات المتاحة، حركات الشراء والمسحوبات",
      icon: "📋",
      color: "from-blue-600 to-indigo-700",
      path: "/boards",
    },
    {
      title: "مخزون الإكسسوارات",
      desc: "إدارة الإكسسوارات والمقابض والخامات المتاحة بالمصنع بحسب الأوزان والعدد",
      icon: "🔩",
      color: "from-cyan-600 to-blue-700",
      path: "/accessories",
    },
  ]

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="المخزون والمستودعات"
        subtitle="إدارة وتتبع مخزون الألواح والإكسسوارات"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {items.map((item, idx) => (
          <div
            key={idx}
            onClick={() => router.push(item.path)}
            className={`card cursor-pointer bg-gradient-to-br ${item.color} text-white shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 p-6 rounded-2xl flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-5xl">{item.icon}</span>
                <span className="bg-white/20 text-xs px-3 py-1 rounded-full font-medium backdrop-blur-sm">
                  عرض المخزون ⬅️
                </span>
              </div>
              <h3 className="font-extrabold text-2xl mb-2">{item.title}</h3>
              <p className="text-sm text-white/90 leading-relaxed">{item.desc}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/20 flex justify-end">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                انتقال للمخزون
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
