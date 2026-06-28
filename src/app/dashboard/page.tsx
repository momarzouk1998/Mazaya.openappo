import { redirect } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { getCurrentProfile } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatNumber, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, STATUS_LABELS, STATUS_COLORS } from "@/lib/format";
import Link from "next/link";
import { WeeklyBarChart, StatusPieChart } from "@/components/DashboardCharts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // Fetch metrics — مع error handling لكل query لو في مشكلة في الجدول
  const safeQuery = async <T,>(p: any): Promise<{ data: T[]; error: string | null }> => {
    try {
      const r = await p;
      return { data: (r.data ?? []) as T[], error: r.error?.message ?? null };
    } catch (e: any) {
      return { data: [] as T[], error: e?.message ?? String(e) };
    }
  };
  const [boardsR, accessoriesR, ordersR, journalR, suppliersR] = await Promise.all([
    safeQuery<any>(supabase.from("mazaya_boards_inventory").select("unit_price, quantity_remaining")),
    safeQuery<any>(supabase.from("mazaya_accessories_inventory").select("unit_price, quantity_remaining")),
    safeQuery<any>(supabase.from("mazaya_orders").select("status, created_at")),
    safeQuery<any>(supabase.from("mazaya_journal_entries").select("entry_type, amount, date, is_pass_through").order("date", { ascending: false }).limit(200)),
    safeQuery<any>(supabase.from("mazaya_suppliers").select("id")),
  ]);
  const boards = boardsR.data, accessories = accessoriesR.data, orders = ordersR.data, journal = journalR.data, suppliers = suppliersR.data;
  const queryErrors = [boardsR, accessoriesR, ordersR, journalR, suppliersR].filter(r => r.error).map(r => r.error);

  const inventoryValue = (boards ?? []).reduce((s, b) => s + (b.unit_price * b.quantity_remaining), 0)
                       + (accessories ?? []).reduce((s, a) => s + (a.unit_price * a.quantity_remaining), 0);

  const openOrders = (orders ?? []).filter(o => o.status === "open" || o.status === "in_progress").length;
  const monthStart = new Date(); monthStart.setDate(1);
  const completedThisMonth = (orders ?? []).filter(o =>
    (o.status === "completed" || o.status === "delivered") &&
    new Date(o.created_at) >= monthStart
  ).length;

  // Balance
  const income = (journal ?? []).filter((j: any) => j.entry_type === "income" && !j.is_pass_through).reduce((s: number, j: any) => s + j.amount, 0);
  const spent = (journal ?? []).filter((j: any) => j.entry_type === "expense" || j.entry_type === "purchase" || j.entry_type === "overhead").reduce((s: number, j: any) => s + j.amount, 0);
  const balance = income - spent;

  // Weekly chart (last 7 days)
  const weekly: Record<string, { day: string; income: number; expense: number; net: number }> = {};
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    weekly[key] = { day: dayNames[d.getDay()], income: 0, expense: 0, net: 0 };
  }
  for (const j of (journal ?? []) as any[]) {
    const k = j.date instanceof Date ? j.date.toISOString().slice(0, 10) : String(j.date ?? '');
    if (weekly[k]) {
      if (j.entry_type === "income" && !j.is_pass_through) weekly[k].income += j.amount;
      if (["expense", "purchase", "overhead"].includes(j.entry_type)) weekly[k].expense += j.amount;
      weekly[k].net = weekly[k].income - weekly[k].expense;
    }
  }

  // Status pie
  const statusCounts: Record<string, number> = { open: 0, in_progress: 0, completed: 0, delivered: 0 };
  for (const o of (orders ?? [])) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  const statusData: { name: string; value: number }[] = Object.entries(statusCounts)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v }));

  const recentJournal = (journal ?? []).slice(0, 5) as any[];

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title={`أهلاً ${profile.username} 👋`}
        subtitle="نظرة سريعة على المصنع اليوم"
        helpTitle="لوحة التحكم"
        helpDescription="من هنا تقدر تشوف ملخص شامل لكل حاجة: قيمة المخزون، الأوردرات المفتوحة، الرصيد الحالي، وأحدث الحركات المالية. اضغط على أي بطاقة للتفاصيل."
      />

      {queryErrors.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 rounded-lg text-sm">
          ⚠️ <strong>تنبيه:</strong> بعض الاستعلامات ما اشتغلتش:
          <ul className="list-disc mr-5 mt-1">{queryErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/orders/new" className="btn-primary">+ أوردر جديد</Link>
        <Link href="/journal/new" className="btn-secondary">+ حركة يومية</Link>
        <Link href="/boards/new" className="btn-secondary">+ شراء جديد</Link>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="قيمة المخزون الحالية"
          value={formatCurrency(inventoryValue)}
          subtitle={`${formatNumber((boards?.length ?? 0) + (accessories?.length ?? 0))} صنف`}
          icon="📦"
          gradient="from-amber-500 to-orange-600"
        />
        <MetricCard
          title="الأوردرات المفتوحة"
          value={formatNumber(openOrders)}
          subtitle="قيد التنفيذ والمفتوحة"
          icon="📋"
          gradient="from-blue-500 to-blue-700"
        />
        <MetricCard
          title="الأوردرات المكتملة (الشهر)"
          value={formatNumber(completedThisMonth)}
          subtitle="هذا الشهر"
          icon="✅"
          gradient="from-green-500 to-emerald-600"
        />
        <MetricCard
          title="الرصيد الحالي"
          value={formatCurrency(balance)}
          subtitle={balance >= 0 ? "لصالح المصنع" : "عجز"}
          icon="💰"
          gradient={balance >= 0 ? "from-emerald-500 to-green-700" : "from-red-500 to-red-700"}
        />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MiniStat label="الموردون النشطون" value={suppliers?.length ?? 0} icon="🏭" />
        <MiniStat label="إجمالي الوارد" value={formatCurrency(income)} icon="⬆️" />
        <MiniStat label="إجمالي المصروف" value={formatCurrency(spent)} icon="⬇️" />
        <MiniStat label="الصافي" value={formatCurrency(income - spent)} icon="📊" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-brand-black mb-3">📊 ملخص اليومية الأسبوعي</h3>
          <div className="h-72">
            <WeeklyBarChart data={Object.values(weekly)} />
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-brand-black mb-3">🥧 حالة الأوردرات</h3>
          {statusData.length > 0 ? (
            <div className="h-72">
              <StatusPieChart data={statusData} />
            </div>
          ) : <div className="h-72 flex items-center justify-center text-gray-400">لا توجد أوردرات</div>}
        </div>
      </div>

      {/* Recent journal */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-brand-black">🕒 آخر 5 حركات مالية</h3>
          <Link href="/journal" className="text-sm text-brand-orange hover:underline">عرض الكل →</Link>
        </div>
        {recentJournal.length === 0 ? (
          <p className="text-gray-400 text-center py-8">لا توجد حركات بعد</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentJournal.map(j => (
              <div key={j.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`badge ${ENTRY_TYPE_COLORS[j.entry_type] || ""}`}>
                    {ENTRY_TYPE_LABELS[j.entry_type] || j.entry_type}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{j.description}</span>
                </div>
                <div className="text-left flex-shrink-0">
                  <div className={`font-bold ${j.entry_type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(j.amount)}
                  </div>
                  <div className="text-xs text-gray-400">{j.date instanceof Date ? j.date.toISOString().slice(0, 10) : String(j.date ?? '')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ title, value, subtitle, icon, gradient }: { title: string; value: string; subtitle: string; icon: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-elevated`}>
      <div className="absolute -left-4 -top-4 text-7xl opacity-20">{icon}</div>
      <div className="relative">
        <div className="text-sm font-medium opacity-90">{title}</div>
        <div className="text-2xl md:text-3xl font-extrabold mt-2">{value}</div>
        <div className="text-xs opacity-80 mt-1">{subtitle}</div>
      </div>
    </div>
  );
}
function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-bold text-brand-black text-sm truncate">{value}</div>
      </div>
    </div>
  );
}
