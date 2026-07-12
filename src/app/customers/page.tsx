"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox, FilterBar } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";

const customerFields: FieldDef[] = [
  { name: "name", label: "اسم العميل", required: true },
  { name: "phone", label: "رقم التواصل" },
  { name: "address", label: "العنوان" },
  { name: "notes", label: "ملاحظات", rows: 2 },
];

export default function CustomersPage() {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { data, loading } = useApi<{ items: any[] }>('/api/customers?limit=500');
  const { data: branchesData } = useApi<{ items: any[] }>('/api/branches?limit=500');
  const { data: ordersData } = useApi<{ items: any[] }>('/api/orders?limit=500');
  const { data: paymentsData } = useApi<{ items: any[] }>('/api/customer-payments?limit=2000');
  const rows = data?.items ?? [];
  const branches = branchesData?.items ?? [];
  const orders = ordersData?.items ?? [];
  const allPayments = paymentsData?.items ?? [];
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const ordersCountMap = useMemo(() => {
    const m: Record<number, number> = {};
    (orders).forEach((o: any) => { if (o.customer_id) m[o.customer_id] = (m[o.customer_id] || 0) + 1; });
    return m;
  }, [orders]);

  const ordersTotalMap = useMemo(() => {
    const m: Record<string, number> = {};
    (orders).forEach((o: any) => { if (o.customer_id) m[o.customer_id] = (m[o.customer_id] || 0) + (o.total || 0); });
    return m;
  }, [orders]);

  const paymentsByCustomer = useMemo(() => {
    const m: Record<string, number> = {};
    allPayments.forEach((p: any) => { if (p.customer_id) m[p.customer_id] = (m[p.customer_id] || 0) + Number(p.amount || 0); });
    return m;
  }, [allPayments]);

  const enriched = useMemo(() => (rows).map((x: any) => ({
    ...x,
    branch_name: x.branch_name ?? "",
    orders_count: ordersCountMap[x.id] || 0,
    total_cost: ordersTotalMap[x.id] || 0,
    total_paid: paymentsByCustomer[x.id] || 0,
  })), [rows, ordersCountMap, ordersTotalMap, paymentsByCustomer]);

  const filtered = useMemo(() => enriched.filter(c =>
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search)) &&
    (!branchFilter || String(c.branch_id) === branchFilter)
  ), [enriched, search, branchFilter]);

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="العملاء"
        subtitle="عملاء المصنع عبر المعارض"
        helpTitle="العملاء"
        helpDescription="هنا بتسجل العملاء بتوع المعارض. كل عميل مرتبط بمعرض محدد. صفحة العميل بتعرض كل أوردراته — بما فيها أوردرات الصيانة اللاحقة — في مكان واحد."
        backHref="/journal"
        actions={<>
          <Button variant="secondary" onClick={() => exportToExcel(filtered, "customers")}>📥 تصدير</Button>
          <Button onClick={() => router.push("/customers/new")}>+ عميل جديد</Button>
        </>}
      />

      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم أو رقم الهاتف..." /></div>
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white">
            <option value="">كل المعارض</option>
            {branches.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </FilterBar>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا يوجد عملاء. ابدأ بإضافة عميل جديد."
        columns={[
          { key: "name", label: "اسم العميل", render: r => <Link href={`/customers/${r.id}`} className="font-semibold text-brand-orange hover:underline">{r.name}</Link> },
          { key: "branch_name", label: "المعرض" },
          { key: "phone", label: "رقم التواصل" },
          { key: "orders_count", label: "الأوردرات" },
          { key: "total_cost", label: "التكلفة", render: r => <span className="font-bold text-brand-orange">{formatCurrency(r.total_cost)}</span> },
          { key: "total_paid", label: "المدفوع", render: r => <span className="font-bold text-green-600">{formatCurrency(r.total_paid)}</span> },
          {
            key: "remaining", label: "المتبقي",
            render: r => {
              const rem = r.total_cost - r.total_paid;
              return <span className={`font-bold ${rem > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(rem)}</span>;
            }
          },
          { key: "address", label: "العنوان" },
          { key: "_actions", label: "إجراءات", render: r => <RowEditor row={r} apiBase="/api/customers" fields={customerFields} entityLabel="العميل" deleteHint="لا يمكن حذف هذا العميل لوجود أوردرات أو سجلات يومية مرتبطة به" /> },
        ]}
      />
    </DashboardLayout>
  );
}
