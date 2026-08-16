"use client";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";

const REPORT_HUBS = [
  {
    title: "تقرير الأوردرات والتكاليف",
    desc: "تكاليف الأوردرات والمصنع مفصولة عن الأعمال الخارجية والدهانات والليد والنقل.",
    icon: "📋",
    badge: "الأوردرات والمقاولين",
    href: "/reports/orders",
    bgHover: "hover:border-indigo-400 hover:bg-indigo-50/20",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    title: "تقرير المخزون والجرد",
    desc: "جرد شامل للألواح والإكسسوارات واحتساب قيمة المتبقي والراكد بالتاريخ.",
    icon: "📦",
    badge: "المخزون والجرد",
    href: "/reports/inventory",
    bgHover: "hover:border-amber-400 hover:bg-amber-50/20",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    title: "تقرير التدفق النقدي واليوميات",
    desc: "كشف الحركات النقدية مع فصل تام بين يومية المصنع ويومية الألواح.",
    icon: "💸",
    badge: "الخزينة واليوميات",
    href: "/reports/cashflow",
    bgHover: "hover:border-emerald-400 hover:bg-emerald-50/20",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    title: "تقرير أجور ويوميات العمال",
    desc: "كشف حساب الأجور ومستحقات العمال وسجل اليوميات والسفريات المحسوبة.",
    icon: "🧑‍🔧",
    badge: "العمال واليوميات",
    href: "/reports/workers",
    bgHover: "hover:border-orange-400 hover:bg-orange-50/20",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    title: "تقرير النثريات والمصاريف",
    desc: "مصاريف تشغيل المصنع العامة فقط (كهرباء، شحن، صيانة، بوفيه) بدون أجور.",
    icon: "📄",
    badge: "النثريات العامة",
    href: "/reports/overhead",
    bgHover: "hover:border-purple-400 hover:bg-purple-50/20",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    title: "تقرير الموردين والمشتريات",
    desc: "إجمالي المشتريات من كل مورد، إجمالي المدفوع له، والديون المستحقة.",
    icon: "🏭",
    badge: "الموردين والمشتريات",
    href: "/reports/suppliers",
    bgHover: "hover:border-red-400 hover:bg-red-50/20",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    title: "تقرير العملاء والتحصيلات",
    desc: "كشف أوردرات العملاء بالمصنع والمعارض، التحصيلات المسددة، والمتبقي.",
    icon: "👥",
    badge: "العملاء والتحصيل",
    href: "/reports/customers",
    bgHover: "hover:border-blue-400 hover:bg-blue-50/20",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
];

export default function ReportsHubPage() {
  const { user: profile } = useUserStore();

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="مركز التقارير"
        subtitle="تقارير تحليلية مجمعة ومباشرة مع فلاتر التاريخ والبحث وتصدير Excel"
        backHref="/journal"
      />

      {/* Sleek Compact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 mb-6">
        {REPORT_HUBS.map((hub) => (
          <Link
            key={hub.href}
            href={hub.href}
            className={`group bg-white rounded-xl p-4 border border-gray-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between ${hub.bgHover}`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-2xl p-2 rounded-xl bg-gray-50 border border-gray-100 group-hover:scale-110 transition-transform">
                  {hub.icon}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${hub.badgeColor}`}>
                  {hub.badge}
                </span>
              </div>
              <h3 className="font-bold text-sm text-gray-900 mb-1 group-hover:text-brand-orange transition-colors">
                {hub.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                {hub.desc}
              </p>
            </div>

            <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-brand-orange">
              <span>عرض التقرير</span>
              <span className="group-hover:translate-x-[-3px] transition-transform">←</span>
            </div>
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
}
