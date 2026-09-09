"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/format";

export default function InventoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, initialized } = useUserStore();
  const [resolvedTable, setResolvedTable] = useState<"boards" | "accessories" | null>(null);

  // جرّب الأول boards وبعدين accessories (زي الموجود)
  const { data: boardItem, loading: boardLoading } = useApi<any>(`/api/boards/${params.id}`);
  const { data: accItem, loading: accLoading } = useApi<any>(`/api/accessories/${params.id}`);

  useEffect(() => {
    if (boardItem?.id && !accItem?.id) setResolvedTable("boards");
    else if (accItem?.id && !boardItem?.id) setResolvedTable("accessories");
    else if (boardItem?.id && accItem?.id) setResolvedTable("boards"); // افتراضي
  }, [boardItem, accItem]);

  const item = boardItem?.id ? boardItem : accItem?.id ? accItem : null;
  const loading = boardLoading || accLoading;
  const table = resolvedTable || "boards";

  // سجل الاستخدام عبر API الجديد
  const { data: usageResp, loading: usageLoading } = useApi<any>(
    item ? `/api/inventory/${params.id}/usage?category=${table}` : null
  );
  const usageRows = usageResp?.usage ?? [];
  const totals = usageResp?.totals ?? { count: 0, total_quantity: 0, total_value: 0 };

  if (!initialized) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full"></div></div>;
  if (!user) return null;
  if (!item && !loading) return <><div className="card">الصنف غير موجود</div></>;

  return (
    <>
      <PageHeader
        title={item?.item_name ?? "..."}
        subtitle={`${item?.code ?? ""} • ${item?.supplier_name ?? "—"}`}
        backHref={`/${table}`}
        actions={
          <Button variant="secondary" onClick={() => exportToExcel(usageRows.map((r: any) => ({
            "الأوردر": r.order_name,
            "العميل": r.customer_name ?? "",
            "المعرض": r.branch_name ?? "",
            "الحالة": r.status,
            "تاريخ البدء": r.start_date,
            "الكمية": r.quantity_used,
            "سعر الوحدة": r.unit_price_snapshot,
            "الإجمالي": r.line_total,
            "تاريخ الاستخدام": r.created_at,
          })), `usage_${item?.code ?? item?.id}`)}>📥 تصدير السجل</Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card"><div className="text-xs text-gray-500">سعر الوحدة</div><div className="text-xl font-bold">{formatCurrency(item?.unit_price)}</div></div>
        <div className="card"><div className="text-xs text-gray-500">الكمية المدخلة</div><div className="text-xl font-bold">{item?.quantity_in}</div></div>
        <div className="card bg-red-50"><div className="text-xs text-gray-500">المستخدم</div><div className="text-xl font-bold text-red-600">{item?.quantity_used ?? 0}</div></div>
        <div className="card bg-green-50"><div className="text-xs text-gray-500">المتبقي</div><div className="text-xl font-bold text-green-600">{item?.quantity_remaining ?? 0}</div></div>
      </div>

      <div className="card mb-4">
        <h3 className="font-bold mb-2">📋 معلومات الصنف</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">الكود:</span> <code className="bg-gray-100 px-2 py-0.5 rounded">{item?.code ?? "-"}</code></div>
          <div><span className="text-gray-500">الخامة/النوع:</span> <strong>{item?.material_type || item?.type || "-"}</strong></div>
          <div><span className="text-gray-500">المورد:</span> <strong>{item?.supplier_name ?? "-"}</strong></div>
          <div><span className="text-gray-500">تاريخ الإضافة:</span> <strong>{formatDate(item?.date_added)}</strong></div>
          <div className="col-span-2"><span className="text-gray-500">ملاحظات:</span> <strong>{item?.notes || "-"}</strong></div>
        </div>
      </div>

      <h3 className="font-bold text-lg mt-6 mb-3">📜 سجل الاستخدام في الأوردرات</h3>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card bg-blue-50"><div className="text-xs text-gray-500">عدد الأوردرات</div><div className="text-xl font-bold text-blue-700">{totals.count}</div></div>
        <div className="card bg-orange-50"><div className="text-xs text-gray-500">إجمالي الكمية المستخدمة</div><div className="text-xl font-bold text-brand-orange">{totals.total_quantity}</div></div>
        <div className="card bg-purple-50"><div className="text-xs text-gray-500">إجمالي القيمة</div><div className="text-xl font-bold text-purple-700">{formatCurrency(totals.total_value)}</div></div>
      </div>

      <DataTable
        loading={usageLoading}
        rows={usageRows}
        emptyMessage="لم يُستخدم بعد في أي أوردر"
        columns={[
          { key: "created_at", label: "تاريخ الاستخدام", render: (r: any) => formatDate(r.created_at) },
          { key: "order_name", label: "الأوردر", render: (r: any) => <Link href={`/orders/${r.order_id}`} className="text-brand-orange hover:underline font-medium">{r.order_name}</Link> },
          { key: "customer_name", label: "العميل", render: (r: any) => r.customer_name ?? "-" },
          { key: "branch_name", label: "المعرض", render: (r: any) => r.branch_name ?? "-" },
          { key: "status", label: "الحالة", render: (r: any) => <span className={`badge ${STATUS_COLORS[r.status] || ""}`}>{STATUS_LABELS[r.status] || r.status}</span> },
          { key: "quantity_used", label: "الكمية", render: (r: any) => <span className="font-bold">{r.quantity_used}</span> },
          { key: "unit_price_snapshot", label: "سعر الوحدة", render: (r: any) => formatCurrency(r.unit_price_snapshot) },
          { key: "line_total", label: "الإجمالي", render: (r: any) => <span className="font-bold">{formatCurrency(r.line_total)}</span> },
        ]}
      />
    </>
  );
}
