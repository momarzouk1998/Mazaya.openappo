"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox, FilterBar } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { PAYMENT_METHOD_LABELS, formatCurrency } from "@/lib/format";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";

const supplierFields: FieldDef[] = [
  { name: "name", label: "اسم الشركة", required: true },
  {
    name: "payment_type",
    label: "نوع التعامل",
    options: [
      { value: "نقدي", label: "نقدي" },
      { value: "تحويل", label: "تحويل" },
      { value: "كلاهما", label: "كلاهما" },
    ],
  },
  { name: "phone", label: "رقم التواصل" },
  { name: "notes", label: "ملاحظات", rows: 2 },
];

export default function SuppliersPage() {
  const router = useRouter();
  const { user, initialized } = useUserStore();
  const { can } = useCan();
  const { data, loading, refetch } = useApi<{ items: any[]; total: number, stats: any }>('/api/suppliers?limit=500');
  const rows = data?.items || [];
  const stats = data?.stats || { totalDebt: 0, totalCredit: 0, suppliersCount: 0 };
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const filtered = useMemo(() => rows.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone ?? "").includes(search);
    const matchPay = !paymentFilter || s.payment_type === paymentFilter;
    return matchSearch && matchPay;
  }), [rows, search, paymentFilter]);

  if (!initialized) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full"></div></div>;
  if (!user) return null;

  return (
    <DashboardLayout profile={user}>
      <PageHeader
        title="الموردون"
        subtitle="إدارة شركات توريد الخامات"
        helpTitle="الموردون"
        helpDescription="هنا بتسجل الـ 7 شركات اللي بتشتري منهم ألواح واكسسوارات، وتقدر تتابع حساباتهم (دائن ومدين)."
        backHref="/journal"
        actions={<>
          <Button variant="secondary" onClick={() => exportToExcel(filtered, "suppliers")}>📥 تصدير Excel</Button>
          {can('suppliers', 'add') && <Button onClick={() => router.push("/suppliers/new")}>+ مورد جديد</Button>}
        </>}
      />

      {/* كاردات الإحصائيات */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="card bg-white border-r-4 border-brand-orange p-4">
            <div className="text-sm text-gray-500 mb-1">إجمالي عدد الموردين</div>
            <div className="text-2xl font-bold text-brand-black">{stats.suppliersCount}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange p-4">
            <div className="text-sm text-gray-500 mb-1">إجمالي الديون المستحقة (لصالح الموردين)</div>
            <div className="text-2xl font-bold text-brand-black">{formatCurrency(stats.totalDebt)}</div>
          </div>
          <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4">
            <div className="text-sm opacity-90 mb-1">إجمالي الأرصدة المقدمة (لصالح المصنع)</div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCredit)}</div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1 min-w-[200px]">
            <SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم أو رقم الهاتف..." />
          </div>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
            <option value="">كل أنواع التعامل</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </FilterBar>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا يوجد موردون. ابدأ بإضافة مورد جديد."
        columns={[
          { key: "name", label: "اسم الشركة", render: (r: any) => <Link href={`/suppliers/${r.id}`} className="font-semibold text-brand-orange hover:underline">{r.name}</Link> },
          { key: "balance", label: "الرصيد", render: (r: any) => {
              if (r.balance === 0) return <span className="text-gray-500 font-bold">0</span>;
              if (r.balance > 0) return <span className="text-red-600 font-bold" title="المصنع مديون للمورد بمبلغ" dir="ltr">{formatCurrency(r.balance)} (له)</span>;
              return <span className="text-green-600 font-bold" title="المصنع دفع بزيادة" dir="ltr">{formatCurrency(Math.abs(r.balance))} (عليه)</span>;
            }
          },
          { key: "payment_type", label: "نوع التعامل", render: (r: any) => PAYMENT_METHOD_LABELS[r.payment_type] || r.payment_type },
          { key: "phone", label: "رقم التواصل", render: (r: any) => r.phone || "-" },
          { key: "notes", label: "ملاحظات", render: (r: any) => <span className="text-gray-500 text-xs">{r.notes || "-"}</span> },
          { key: "_actions", label: "إجراءات", render: (r: any) => (
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => router.push(`/suppliers/${r.id}`)} className="p-1.5 hover:bg-blue-100 rounded transition text-base" title="عرض">👁️</button>
              <RowEditor
                row={r}
                apiBase="/api/suppliers"
                fields={supplierFields}
                entityLabel="المورد"
                refreshPage={false}
                onChanged={() => refetch()}
                deleteHint="لا يمكن حذف هذا المورد لوجود فواتير أو سجلات مرتبطة به"
                canEdit={can('suppliers', 'edit')}
                canDelete={can('suppliers', 'delete')}
              />
            </div>
          )},
        ]}
      />
    </DashboardLayout>
  );
}
