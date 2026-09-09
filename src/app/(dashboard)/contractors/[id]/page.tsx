"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: profile } = useUserStore();
  const { data: contractorData, loading } = useApi<any>(`/api/contractors/${id}`);
  const contractor = contractorData?.data ?? contractorData;

  const [works, setWorks] = useState<any[]>([]);
  useEffect(() => {
    if (!contractor?.id) return;
    fetch(`/api/orders/${id}/external-work`).then(r => r.json()).then(res => setWorks(res?.data ?? []));
  }, [contractor?.id, id]);

  if (!profile) return null;
  if (!contractor && !loading) return <><div className="card">المقاول غير موجود</div></>;

  const total = works.reduce((s, w) => s + (w.amount || 0), 0);

  return (
    <>
      <PageHeader title={contractor?.name ?? "..."} subtitle={contractor?.specialty ?? ""} backHref="/contractors" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="text-sm text-gray-500">النوع</div><div className="text-xl font-bold">{contractor?.specialty ?? "-"}</div></div>
        <div className="card"><div className="text-sm text-gray-500">التواصل</div><div className="text-xl font-bold">{contractor?.phone ?? "-"}</div></div>
        <div className="card"><div className="text-sm text-gray-500">إجمالي الأعمال</div><div className="text-xl font-bold text-brand-orange">{formatCurrency(total)}</div></div>
      </div>

      {contractor?.notes && <div className="card mb-4">📝 {contractor.notes}</div>}

      <h3 className="font-bold text-lg mt-6 mb-3">🔨 الأعمال المسندة</h3>
      <DataTable
        rows={works}
        emptyMessage="لا توجد أعمال مسجلة"
        columns={[
          { key: "created_at", label: "تاريخ التسجيل", render: r => formatDate(r.created_at) },
          { key: "work_type", label: "نوع الشغل" },
          { key: "contractor_name", label: "المقاول", render: r => r.contractor_name ?? "-" },
          { key: "amount", label: "القيمة", render: r => formatCurrency(r.amount) },
          { key: "notes", label: "ملاحظات" },
        ]}
      />
    </>
  );
}
