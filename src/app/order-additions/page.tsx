"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/Button"

export default function OrderAdditionsPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const [activeTab, setActiveTab] = useState<"transport" | "paints" | "led" | "external">("transport")

  if (!profile) return null

  const tabs = [
    {
      id: "transport",
      label: "🚚 النقل الداخلي ومصاريف الطريق",
      path: "/internal-transport",
      desc: "حركات نقل البضاعة والشحن ومصاريف الطريق بين المصنع والمواقع",
      color: "from-blue-600 to-indigo-700",
      icon: "🚚",
    },
    {
      id: "paints",
      label: "🎨 مصاريف الدهانات والمرمات",
      path: "/paints",
      desc: "التينر والبتاين والصبغات ومرمات الدهانات والألوان المسندة للأوردرات",
      color: "from-purple-600 to-pink-700",
      icon: "🎨",
    },
    {
      id: "led",
      label: "💡 مصاريف الليد والكهرباء",
      path: "/led-expenses",
      desc: "بضاعة ومصنعية الليد والكهرباء وتتخصم تلقائياً من يومية المصنع",
      color: "from-amber-500 to-yellow-600",
      icon: "💡",
    },
    {
      id: "external",
      label: "🔨 الأعمال الخارجية للمقاولين",
      path: "/external-work",
      desc: "تسجيل وتتبع تكاليف الأعمال الخارجية المسندة للورش والمقاولين للأوردرات",
      color: "from-emerald-600 to-teal-700",
      icon: "🔨",
    },
  ] as const

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="إضافات الأوردرات"
        subtitle="المجمع الموحد لمصاريف وإضافات الأوردرات (النقل، الدهانات، الليد، الأعمال الخارجية)"
      />

      {/* كروت الأقسام الرئيسية / التابات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className={`card cursor-pointer bg-gradient-to-br ${tab.color} text-white shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1 p-5 rounded-2xl flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-4xl">{tab.icon}</span>
                <span className="bg-white/20 text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
                  عرض القسم ⬅️
                </span>
              </div>
              <h3 className="font-extrabold text-lg mb-1">{tab.label}</h3>
              <p className="text-xs text-white/80 leading-relaxed">{tab.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/20 flex justify-end">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                انتقال للصفحة
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* لوحة التوجيه السريع والتوضيح */}
      <div className="card bg-brand-orange-light/20 border border-brand-orange/30 p-6 rounded-2xl">
        <h3 className="font-bold text-lg text-brand-orange-dark mb-2 flex items-center gap-2">
          <span>💡</span> دليل استخدام إضافات الأوردرات
        </h3>
        <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
          <li>
            <strong>مصاريف الدهانات والمرمات:</strong> يمكنك تسجيل مصاريف التينر والصبغات دون ربطها بمخزن الإكسسوارات.
          </li>
          <li>
            <strong>مصاريف الليد والكهرباء:</strong> تسجل تفصيلياً (بضاعة + مصنعية) وتُخصم تلقائياً من <strong>يومية المصنع</strong>.
          </li>
          <li>
            <strong>النقل الداخلي:</strong> مصاريف الشحن والتوصيل للمواقع ومستبعدة تماماً من النثريات العامة.
          </li>
          <li>
            يمكنك الوصول لأي قسم من الأزرار العلوية، وفي كل صفحة ستجد زر <strong>⬅️ إضافات الأوردرات</strong> للعودة هنا في أي وقت.
          </li>
        </ul>
      </div>
    </DashboardLayout>
  )
}
