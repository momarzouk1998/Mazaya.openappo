"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useApi, useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

const CATEGORIES = [
  { value: "board", label: "خامات ألواح" },
  { value: "accessory", label: "إكسسوارات" },
];

const CATEGORY_LABELS: Record<string, string> = {
  board: "خامات ألواح",
  accessory: "إكسسوارات",
};

export default function MaterialTypesPage() {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { data, loading, refetch } = useApi<{ items: any[] }>('/api/material-types?limit=500');
  const { mutate } = useApiMutation();
  const rows = data?.items ?? [];
  const [filter, setFilter] = useState<string>("all");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("board");
  const [saving, setSaving] = useState(false);

  async function addItem() {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await mutate('POST', '/api/material-types', { name: newName.trim(), category: newCategory, sort_order: 99 });
    if (!error) {
      setNewName("");
      await refetch();
    }
    setSaving(false);
  }

  async function toggleActive(r: any) {
    await mutate('PATCH', '/api/material-types/' + r.id, { is_active: !r.is_active });
    refetch();
  }

  async function deleteItem(r: any) {
    if (!confirm(`حذف "${r.name}"؟ لا يمكن التراجع.`)) return;
    await mutate('DELETE', '/api/material-types/' + r.id);
    refetch();
  }

  const filtered = filter === "all" ? rows : rows.filter(r => r.category === filter);

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="أنواع المواد"
        subtitle="خامات الألواح والإكسسوارات — تظهر في القوائم المنسدلة بالمخازن"
        helpTitle="أنواع المواد"
        helpDescription="من هنا بتتحكم في أنواع الخامات اللي بتظهر في صفحة مخازن الألواح والإكسسوارات. أي إضافة أو تعديل يظهر فوراً في القوائم."
        backHref="/dashboard"
      />

      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Select label="تصفية حسب" value={filter} onChange={e => setFilter(e.target.value)}
            options={[
              { value: "all", label: "الكل" },
              ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
            ]}
          />
        </div>
      </div>

      <div className="card mb-6 bg-gradient-to-br from-orange-50 to-white border border-orange-100">
        <h3 className="text-sm font-bold text-gray-700 mb-3">➕ إضافة نوع جديد</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <Input label="اسم النوع" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="مثال: لوح خشب طبيعي" />
          </div>
          <Select label="التصنيف" value={newCategory} onChange={e => setNewCategory(e.target.value)}
            options={CATEGORIES} />
          <Button onClick={addItem} loading={saving}>إضافة</Button>
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا توجد أنواع مواد"
        columns={[
          {
            key: "category", label: "التصنيف",
            render: r => <span className={`badge ${r.category === "board" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
              {CATEGORY_LABELS[r.category] || r.category}
            </span>,
          },
          { key: "name", label: "الاسم", render: r => <span className="font-medium">{r.name}</span> },
          { key: "sort_order", label: "الترتيب" },
          {
            key: "is_active", label: "الحالة",
            render: r => <button onClick={() => toggleActive(r)}
              className={`badge cursor-pointer ${r.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {r.is_active ? "نشط" : "معطل"}
            </button>,
          },
          {
            key: "actions", label: "إجراءات",
            render: r => (
              <div className="flex items-center gap-1">
                <button onClick={() => deleteItem(r)}
                  className="p-1.5 hover:bg-red-100 rounded text-red-600" title="حذف">🗑️</button>
              </div>
            ),
          },
        ]}
      />
    </DashboardLayout>
  );
}
