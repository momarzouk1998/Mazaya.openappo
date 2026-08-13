"use client"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/Button"

export default function CustomersBranchesHubPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()

  if (!profile) return null

  const items = [
    {
      title: "قائمة العملاء",
      desc: "بيانات العملاء السابقة والحالية وحسابات كل عميل وتفاصيل أوردراته",
      icon: "👥",
      color: "from-teal-600 to-emerald-700",
      path: "/customers",
    },
    {
      title: "مدفوعات العملاء",
      desc: "سجل الدفعات والتحصيلات المالية المباشرة الواردة من العملاء",
      icon: "💳",
      color: "from-emerald-500 to-green-600",
      path: "/payments",
    },
    {
      title: "المعارض والفروع",
      desc: "بيانات فروع ومعارض الشركة والحسابات المالية والتمريرات المالية لكل معرض",
      icon: "🏪",
      color: "from-blue-600 to-cyan-700",
      path: "/branches",
    },
  ]

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="العملاء والمعارض"
        subtitle="مجمع العملاء والتحصيلات المالية ومعارض الشركة"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
                  عرض ⬅️
                </span>
              </div>
              <h3 className="font-extrabold text-2xl mb-2">{item.title}</h3>
              <p className="text-sm text-white/90 leading-relaxed">{item.desc}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/20 flex justify-end">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                انتقال للصفحة
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
