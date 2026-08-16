"use client";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";

const REPORT_HUBS = [
  {
    title: "تقرير الأوردرات والتكاليف الشاملة",
    desc: "كشف تكاليف الأوردرات، تكلفة المصنع الحقيقية مفصولة عن الأعمال الخارجية، وإضافات الدهانات والليد والنقل.",
    icon: "📋",
    badge: "أوردرات ومقاولين",
    color: "from-blue-500/10 via-indigo-500/5 to-transparent border-indigo-200 hover:border-indigo-400",
    iconBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    badgeColor: "bg-indigo-100 text-indigo-800",
    href: "/reports/orders",
    features: ["فصل الأعمال الخارجية للمقاولين", "إضافات الدهانات والليد", "تفصيل تكاليف الخامات واليوميات"],
  },
  {
    title: "تقرير المخزون والجرد الدوري",
    desc: "جرد شامل وتفصيلي للألواح والإكسسوارات مع احتساب قيمة المتبقي والراكد بالتاريخ والفترة الزمنية.",
    icon: "📦",
    badge: "مخزون وجرد",
    color: "from-amber-500/10 via-orange-500/5 to-transparent border-amber-200 hover:border-amber-400",
    iconBg: "bg-amber-50 text-amber-700 border-amber-200",
    badgeColor: "bg-amber-100 text-amber-800",
    href: "/reports/inventory",
    features: ["جرد مخصص للألواح", "جرد مخصص للإكسسوارات", "تقييم مالي لحركة المخزون بالتاريخ"],
  },
  {
    title: "تقرير التدفق النقدي واليوميات",
    desc: "كشف كامل للحركات المالية مع فصل تام بين يومية المصنع ويومية الألواح وتوضيح حركة الخزينة والوارد والمصروف.",
    icon: "💸",
    badge: "نقدية ومحافظ",
    color: "from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-200 hover:border-emerald-400",
    iconBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800",
    href: "/reports/cashflow",
    features: ["يومية المصنع التشغيلية", "يومية الألواح التمريرية", "صافي التدفق النقدي الشامل"],
  },
  {
    title: "تقرير أجور ويوميات العمال",
    desc: "سجل متكامل لأجور ويوميات العمال المحسوبة على الأوردرات، أيام السفرية، ومستحقات كل عامل.",
    icon: "🧑‍🔧",
    badge: "عمال ويوميات",
    color: "from-orange-500/10 via-amber-500/5 to-transparent border-orange-200 hover:border-orange-400",
    iconBg: "bg-orange-50 text-orange-700 border-orange-200",
    badgeColor: "bg-orange-100 text-orange-800",
    href: "/reports/workers",
    features: ["ملخص حسابات العمال", "سجل اليوميات التفصيلي بالأوردر", "احتساب بدلات وأيام السفر"],
  },
  {
    title: "تقرير النثريات والمصاريف التشغيلية",
    desc: "مصاريف تشغيل المصنع العامة فقط (كهرباء، شحن، صيانة عامة، بوفيه) مستبعد منها أجور العمال تماماً.",
    icon: "📄",
    badge: "نثريات تشغيل",
    color: "from-purple-500/10 via-fuchsia-500/5 to-transparent border-purple-200 hover:border-purple-400",
    iconBg: "bg-purple-50 text-purple-700 border-purple-200",
    badgeColor: "bg-purple-100 text-purple-800",
    href: "/reports/overhead",
    features: ["نثريات عامة فقط", "توزيع المصاريف حسب التصنيف", "تتبع طرق الدفع والبيان"],
  },
  {
    title: "تقرير الموردين وحسابات المشتريات",
    desc: "كشف إجمالي المشتريات من كل مورد للألواح والإكسسوارات، إجمالي المدفوع، والأرصدة والديون المستحقة.",
    icon: "🏭",
    badge: "موردين ومشتريات",
    color: "from-red-500/10 via-rose-500/5 to-transparent border-red-200 hover:border-red-400",
    iconBg: "bg-red-50 text-red-700 border-red-200",
    badgeColor: "bg-red-100 text-red-800",
    href: "/reports/suppliers",
    features: ["إجمالي مشتريات الخامات", "سجل السدادات والمدفوعات", "كشف الديون والمتبقي للموردين"],
  },
  {
    title: "تقرير العملاء والتحصيلات",
    desc: "كشف شامل لأوردرات العملاء بالمصنع والمعارض، إجمالي الدفعات المسددة، والمبالغ المتبقية في ذمتهم.",
    icon: "👥",
    badge: "عملاء وتحصيل",
    color: "from-indigo-500/10 via-blue-500/5 to-transparent border-indigo-200 hover:border-indigo-400",
    iconBg: "bg-blue-50 text-blue-700 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-800",
    href: "/reports/customers",
    features: ["عدد وقيمة أوردرات كل عميل", "إجمالي التحصيلات والمدفوعات", "المتبقي ومستحقات المصنع"],
  },
];

export default function ReportsHubPage() {
  const { user: profile } = useUserStore();

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="مركز التقارير والإحصائيات"
        subtitle="اختر التقرير المطلوب لفتح صفحته المخصصة مباشرة مع الفلاتر الفورية والتصدير"
        helpTitle="مركز التقارير"
        helpDescription="كل تقرير يفتح في صفحة مستقلة تعرض البيانات تلقائياً وتتيح الفلترة بالتاريخ والتصدير لـ Excel."
        backHref="/journal"
      />

      {/* Grid of Report Hub Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {REPORT_HUBS.map((hub) => (
          <Link
            key={hub.href}
            href={hub.href}
            className={`group card p-5 bg-gradient-to-br ${hub.color} border transition-all duration-200 hover:shadow-lg hover:scale-[1.01] flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-3xl p-2.5 rounded-2xl border ${hub.iconBg}`}>
                  {hub.icon}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${hub.badgeColor}`}>
                  {hub.badge}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-gray-900 mb-1.5 group-hover:text-brand-orange transition-colors">
                {hub.title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                {hub.desc}
              </p>
            </div>

            <div>
              <div className="space-y-1 border-t pt-3 mb-4">
                {hub.features.map((f, i) => (
                  <div key={i} className="text-[11px] text-gray-500 flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-brand-orange-dark group-hover:translate-x-[-4px] transition-transform">
                <span>فتح التقرير المباشر</span>
                <span>←</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
}
