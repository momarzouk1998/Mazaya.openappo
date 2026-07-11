"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi, useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/DataTable";
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, ORDER_TYPE_LABELS } from "@/lib/format";
import { canSeeModule } from "@/lib/auth";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { mutate } = useApiMutation();

  const { data: order, loading, error, refetch: refetchOrder } = useApi<any>(`/api/orders/${id}`);
  const { data: materialsData } = useApi<any[]>(`/api/orders/${id}/materials`);
  const { data: externalData } = useApi<any[]>(`/api/orders/${id}/external-work`);
  const { data: extraCostsData } = useApi<any[]>(`/api/orders/${id}/extra-costs`);
  const { data: journalResp } = useApi<{ entries: any[] } | any[]>(`/api/journal?order_id=${id}&limit=500`);

  const materials = materialsData ?? (order?.materials ?? []);
  const costs = order ? {
    boards_cost: order.boards_cost ?? 0,
    accessories_cost: order.accessories_cost ?? 0,
    installation_cost: order.installation_cost ?? 0,
    // (F6) — اقرأ القيمة الحقيقية من الأوردر بدل ما تكون ثابت 0
    installation_travel_days: order.installation_travel_days ?? 0,
    internal_transport_cost: order.internal_transport_cost ?? 0,
    external_transport_cost: order.external_transport_cost ?? 0,
    factory_commission: order.factory_commission ?? 0,
    order_total: order.order_total ?? 0,
  } : null;
  const external = externalData ?? (order?.external_work ?? []);
  const extraCosts = extraCostsData ?? (order?.extra_costs ?? []);
  const extraCostsTotal = extraCosts.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const transfers = Array.isArray(journalResp)
    ? journalResp
    : (journalResp?.entries ?? []);

  async function setStatus(status: string) {
    await mutate('PATCH', `/api/orders/${id}`, { status });
    await refetchOrder();
  }

  async function deleteOrder() {
    if (!confirm("هل أنت متأكد من حذف هذا الأوردر؟ سيتم إرجاع المواد المستخدمة للمخزون.")) return;
    await mutate('DELETE', `/api/orders/${id}`);
    router.push("/orders");
    router.refresh();
  }

  if (!profile) return null;
  if (!order && !loading) return <DashboardLayout profile={profile}><div className="card">⚠️ الأوردر غير موجود {error && <span className="text-sm text-red-500">— {error}</span>}</div></DashboardLayout>;

  const isAdmin = profile.role === "admin";
  const showTransfers = canSeeModule(profile, "journal");
  const transfersSum = transfers.filter(t => t.entry_type === "دفعة واردة من معرض" && !t.is_passthrough).reduce((s, t) => s + Number(t.amount), 0);
  const orderTotal = costs?.order_total ?? 0;
  const balance = transfersSum - orderTotal;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title={order?.order_name ?? "..."}
	        subtitle={`${ORDER_TYPE_LABELS[order?.order_type ?? "تصنيع جديد"]} • ${order?.mazaya_customers?.name ?? "—"} • ${order?.mazaya_branches?.name ?? "—"}`}
        backHref="/orders"
        actions={isAdmin ? (
          <>
            <Link href={`/orders/${id}/edit`}><Button variant="secondary">✏️ تعديل</Button></Link>
            <Link href={`/orders/${id}/invoice`}><Button variant="secondary">🧾 الفاتورة</Button></Link>
            <Button variant="danger" onClick={deleteOrder}>🗑️ حذف</Button>
          </>
        ) : (
          <Link href={`/orders/${id}/invoice`}><Button>🧾 الفاتورة</Button></Link>
        )}
      />

      {order && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card"><div className="text-xs text-gray-500">الحالة</div>
            {isAdmin ? (
              <select value={order.status} onChange={e => setStatus(e.target.value)} className={`mt-1 w-full px-2 py-1.5 border rounded text-sm font-semibold`}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <span className={`badge mt-1 ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
            )}
          </div>
          <div className="card"><div className="text-xs text-gray-500">تاريخ البدء</div><div className="font-bold mt-1">{formatDate(order.start_date)}</div></div>
          <div className="card"><div className="text-xs text-gray-500">تاريخ الانتهاء</div><div className="font-bold mt-1">{formatDate(order.end_date)}</div></div>
          <div className="card"><div className="text-xs text-gray-500">عدد العمال</div><div className="font-bold mt-1 text-brand-orange">{order.workers_count ?? 0}</div></div>
        </div>
      )}

      {order?.notes && <div className="card mb-4">📝 {order.notes}</div>}

      {/* المواد */}
      <h3 className="font-bold text-lg mt-6 mb-3">📦 المواد المستخدمة</h3>
      <DataTable
        rows={materials as any[]}
        emptyMessage="لا توجد مواد"
        columns={[
          { key: "name", label: "الصنف", render: (r: any) => r.item_name || r.mazaya_boards_inventory?.item_name || r.mazaya_accessories_inventory?.item_name || "-" },
          { key: "code", label: "الكود", render: (r: any) => r.item_code || r.mazaya_boards_inventory?.code || r.mazaya_accessories_inventory?.code || "-" },
          { key: "type", label: "النوع", render: (r: any) => r.item_category === "boards_inventory" || r.board_id ? "لوح" : "اكسسوار" },
          { key: "quantity_used", label: "الكمية" },
          { key: "unit_price_snapshot", label: "السعر", render: (r: any) => formatCurrency(r.unit_price_snapshot) },
          { key: "line_total", label: "الإجمالي", render: (r: any) => <span className="font-bold">{formatCurrency(r.line_total)}</span> },
        ]}
      />

      {/* التكاليف */}
      {costs && (
        <>
          <h3 className="font-bold text-lg mt-6 mb-3">💰 التكاليف</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card"><div className="text-xs text-gray-500">ألواح</div><div className="font-bold">{formatCurrency(costs.boards_cost)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">اكسسوارات</div><div className="font-bold">{formatCurrency(costs.accessories_cost)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">تركيبات</div><div className="font-bold">{formatCurrency(costs.installation_cost)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">أيام سفر</div><div className="font-bold">{costs.installation_travel_days || 0}</div></div>
            <div className="card"><div className="text-xs text-gray-500">نقل داخلي</div><div className="font-bold">{formatCurrency(costs.internal_transport_cost)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">نقل خارجي</div><div className="font-bold">{formatCurrency(costs.external_transport_cost)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">عمولة المصنع</div><div className="font-bold">{formatCurrency(costs.factory_commission)}</div></div>
            <div className={`card ${extraCostsTotal > 0 ? "bg-yellow-50 border-yellow-200" : ""}`}><div className="text-xs text-gray-500">تكاليف إضافية</div><div className="font-bold">{formatCurrency(extraCostsTotal)}</div></div>
            <div className="card bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white md:col-span-4"><div className="text-xs opacity-90">الإجمالي</div><div className="font-extrabold text-lg">{formatCurrency(costs.order_total)}</div></div>
          </div>
          {extraCosts.length > 0 && (
            <div className="card mb-4">
              <h4 className="font-bold text-sm mb-2">➕ تفاصيل التكاليف الإضافية</h4>
              <div className="space-y-1 text-sm">
                {extraCosts.map((e: any) => (
                  <div key={e.id} className="flex justify-between py-1 border-b last:border-0">
                    <span>{e.cost_type}{e.notes ? ` — ${e.notes}` : ""}</span>
                    <strong>{formatCurrency(Number(e.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* الأعمال الخارجية */}
      {external.length > 0 && (
        <>
          <h3 className="font-bold text-lg mt-6 mb-3">🔨 أعمال خارجية (تتبع فقط)</h3>
          <DataTable
            rows={external as any[]}
            emptyMessage="—"
            columns={[
              { key: "type", label: "النوع", render: (r: any) => r.work_type },
              { key: "contractor", label: "المقاول", render: (r: any) => r.contractor_name ?? r.mazaya_contractors?.name ?? "-" },
              { key: "amount", label: "القيمة", render: (r: any) => formatCurrency(r.amount) },
              { key: "notes", label: "ملاحظات" },
            ]}
          />
        </>
      )}

      {/* التحويلات */}
      {showTransfers && (
        <>
          <h3 className="font-bold text-lg mt-6 mb-3">💸 التحويلات المرتبطة بهذا الأوردر</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="card"><div className="text-xs text-gray-500">إجمالي التحويلات</div><div className="font-bold text-green-600 text-lg">{formatCurrency(transfersSum)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">تكلفة الأوردر</div><div className="font-bold text-lg">{formatCurrency(orderTotal)}</div></div>
            <div className="card"><div className="text-xs text-gray-500">الفرق</div><div className={`font-bold text-lg ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(balance)}</div></div>
          </div>
          <DataTable
            rows={transfers as any[]}
            emptyMessage="لا توجد تحويلات"
            columns={[
              { key: "entry_date", label: "التاريخ", render: (r: any) => formatDate(r.entry_date) },
              { key: "description", label: "البيان" },
              { key: "entry_type", label: "النوع" },
              { key: "payment_method", label: "الطريقة" },
              { key: "amount", label: "المبلغ", render: (r: any) => <span className="font-bold">{formatCurrency(r.amount)}</span> },
            ]}
          />
        </>
      )}
    </DashboardLayout>
  );
}
