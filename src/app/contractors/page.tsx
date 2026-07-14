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
import { formatCurrency } from "@/lib/format";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";

const contractorFields: FieldDef[] = [
  { name: "name", label: "اسم المقاول", required: true },
  { name: "phone", label: "رقم التواصل" },
  { name: "notes", label: "ملاحظات", rows: 2 },
];

export default function ContractorsPage() {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data, loading } = useApi<{ items: any[] }>('/api/contractors?limit=500');
  const rows = data?.items ?? [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => rows.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="المقاولون الخارجيون"
        subtitle="ورش الألوميتال والتنجيد وغيرها"
        helpTitle="المقاولون"
        helpDescription="الورش اللي المصنع بيشتغل معاها بره: ألوميتال، تنجيد، نقل. المبالغ هنا بتتسجل للتتبع بس ومش بتدخل في تكلفة الأوردر لأن المعرض بيحول للمقاول مباشرة."
        backHref="/journal"
        actions={<>
          <Button variant="secondary" onClick={() => exportToExcel(filtered, "contractors")}>📥 تصدير</Button>
          {can('contractors', 'add') && <Button onClick={() => router.push("/contractors/new")}>+ مقاول جديد</Button>}
        </>}
      />

      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم..." /></div>
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </FilterBar>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا يوجد مقاولون"
        columns={[
          { key: "name", label: "الاسم", render: r => <Link href={`/contractors/${r.id}`} className="font-semibold text-brand-orange hover:underline">{r.name}</Link> },
          { key: "phone", label: "رقم التواصل" },
          { key: "total_work", label: "إجمالي الأعمال", render: r => formatCurrency(r.total_work || 0) },
          { key: "notes", label: "ملاحظات" },
          { key: "_actions", label: "إجراءات", render: r => <RowEditor row={r} apiBase="/api/contractors" fields={contractorFields} entityLabel="المقاول" deleteHint="لا يمكن حذف هذا المقاول لوجود أعمال خارجية مسندة إليه" canEdit={can('contractors', 'edit')} canDelete={can('contractors', 'delete')} /> },
        ]}
      />
    </DashboardLayout>
  );
}
