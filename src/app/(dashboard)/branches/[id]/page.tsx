"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/format";

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: profile } = useUserStore();
  const { data: branchResponse, loading } = useApi<any>(`/api/branches/${id}`);
  const { data: customersResponse } = useApi<{ items: any[] }>(`/api/customers?branch_id=${id}&limit=500`);
  const { data: ordersResponse } = useApi<{ items: any[] }>(`/api/orders?branch_id=${id}&limit=500`);
  const { data: journalResponse } = useApi<{ items: any[] }>(`/api/journal?branch_id=${id}&entry_type=دفعة واردة من معرض&limit=500`);

  const branch = branchResponse?.data ?? branchResponse;
  const customers = customersResponse?.items ?? [];
  const orders = ordersResponse?.items ?? [];
  const incomes = journalResponse?.items ?? [];

  if (!profile) return null;
  if (!branch && !loading) return <><div className="card">المعرض غير موجود</div></>;

  const totalIncome = incomes.reduce((s, i) => s + (i.is_passthrough ? 0 : Number(i.amount)), 0);

  return (
    <>
      <PageHeader title={branch?.name ?? "..."} subtitle={branch?.location ?? ""} backHref="/branches" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="text-sm text-gray-500">عدد العملاء</div><div className="text-2xl font-extrabold">{customers.length}</div></div>
        <div className="card"><div className="text-sm text-gray-500">عدد الأوردرات</div><div className="text-2xl font-extrabold">{orders.length}</div></div>
        <div className="card"><div className="text-sm text-gray-500">إجمالي التحويلات</div><div className="text-2xl font-extrabold text-green-600">{formatCurrency(totalIncome)}</div></div>
      </div>

      <h3 className="font-bold text-lg mt-6 mb-3">👥 العملاء</h3>
      <DataTable
        rows={customers}
        emptyMessage="لا يوجد عملاء لهذا المعرض"
        columns={[
          { key: "name", label: "الاسم", render: r => <Link href={`/customers/${r.id}`} className="text-brand-orange hover:underline">{r.name}</Link> },
          { key: "phone", label: "رقم التواصل" },
          { key: "address", label: "العنوان" },
        ]}
      />

      <h3 className="font-bold text-lg mt-6 mb-3">📦 أوردرات المعرض</h3>
      <DataTable
        rows={orders}
        emptyMessage="لا توجد أوردرات"
        columns={[
          { key: "order_name", label: "اسم الأوردر", render: r => <Link href={`/orders/${r.id}`} className="text-brand-orange hover:underline">{r.order_name}</Link> },
          { key: "customer", label: "العميل", render: r => r.mazaya_customers?.name ?? "-" },
          { key: "status", label: "الحالة" },
          { key: "start_date", label: "البدء", render: r => formatDate(r.start_date) },
        ]}
      />

      <h3 className="font-bold text-lg mt-6 mb-3">💰 التحويلات المستلمة</h3>
      <DataTable
        rows={incomes}
        emptyMessage="لم يستلم تحويلات بعد"
        columns={[
          { key: "entry_date", label: "التاريخ", render: r => formatDate(r.entry_date) },
          { key: "description", label: "البيان" },
          { key: "payment_method", label: "طريقة الدفع" },
          { key: "amount", label: "المبلغ", render: r => <span className="font-bold text-green-600">{formatCurrency(r.amount)}</span> },
        ]}
      />
    </>
  );
}
