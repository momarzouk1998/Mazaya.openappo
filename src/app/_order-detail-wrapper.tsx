"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi, useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  const { data: extraCostsData, refetch: refetchExtraCosts } = useApi<any[]>(`/api/orders/${id}/extra-costs`);
  const { data: journalResp } = useApi<{ entries: any[] } | any[]>(`/api/journal?order_id=${id}&limit=500`);

  // نثريات الأوردر
  const [overheadAmount, setOverheadAmount] = useState("");
  const [overheadDesc, setOverheadDesc] = useState("");
  const [overheadSaving, setOverheadSaving] = useState(false);

  const materials = materialsData ?? (order?.materials ?? []);
  const costs = order ? {
    boards_cost: order.boards_cost ?? 0,
    accessories_cost: order.accessories_cost ?? 0,
    installation_cost: order.installation_cost ?? 0,
    installation_travel_days: order.installation_travel_days ?? 0,
    internal_transport_cost: order.internal_transport_cost ?? 0,
    external_transport_cost: order.external_transport_cost ?? 0,
    factory_commission: order.factory_commission ?? 0,
    worker_logs_total: order.worker_logs_total ?? 0,
    road_expenses_total: order.road_expenses_total ?? 0,
    order_total: order.order_total ?? 0,
  } : null;
  const workerLogs = order?.worker_logs ?? [];
  const roadExpenses = order?.road_expenses ?? [];
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

  async function addOverhead(e: React.FormEvent) {
    e.preventDefault();
    if (!overheadAmount || !overheadDesc) return;
    setOverheadSaving(true);
    try {
      await mutate('POST', `/api/orders/${id}/extra-costs`, {
        cost_type: 'نثريات',
        amount: Number(overheadAmount),
        notes: overheadDesc,
      });
      setOverheadAmount("");
      setOverheadDesc("");
      refetchExtraCosts();
      refetchOrder();
    } finally {
      setOverheadSaving(false);
    }
  }

  async function deleteOverhead(extraId: string) {
    if (!confirm("حذف هذه النثرية؟")) return;
    await mutate('DELETE', `/api/orders/${id}/extra-costs?extra_id=${extraId}`);
    refetchExtraCosts();
    refetchOrder();
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
            <div className={`card ${costs.worker_logs_total > 0 ? "bg-orange-50 border border-orange-200" : ""}`}>
              <div className="text-xs text-gray-500">أجور العمال (يوميات)</div>
              <div className="font-bold text-orange-700">{formatCurrency(costs.worker_logs_total)}</div>
            </div>
            <div className={`card ${costs.road_expenses_total > 0 ? "bg-amber-50 border border-amber-200" : ""}`}>
              <div className="text-xs text-gray-500">مصاريف الطريق</div>
              <div className="font-bold text-amber-700">{formatCurrency(costs.road_expenses_total)}</div>
            </div>
            {/* مصاريف دهانات */}
            {(() => {
              const paintsItems = extraCosts.filter((e: any) => e.cost_type === 'مصاريف دهانات' || e.cost_type === 'دهانات');
              const paintsTotal = paintsItems.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
              return (
                <div className={`card ${paintsTotal > 0 ? "bg-fuchsia-50 border border-fuchsia-200" : ""}`}>
                  <div className="text-xs text-gray-500">🎨 مصاريف دهانات</div>
                  <div className="font-bold text-fuchsia-700">{formatCurrency(paintsTotal)}</div>
                </div>
              );
            })()}
            {/* مصاريف ليد */}
            {(() => {
              const ledItems = extraCosts.filter((e: any) => e.cost_type === 'مصاريف ليد' || e.cost_type === 'ليد');
              const ledTotal = ledItems.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
              return (
                <div className={`card ${ledTotal > 0 ? "bg-yellow-50 border border-yellow-200" : ""}`}>
                  <div className="text-xs text-gray-500">💡 مصاريف ليد</div>
                  <div className="font-bold text-yellow-700">{formatCurrency(ledTotal)}</div>
                </div>
              );
            })()}
            {/* نثريات الأوردر */}
            {(() => {
              const overheadItems = extraCosts.filter((e: any) => e.cost_type === 'نثريات');
              const overheadTotal = overheadItems.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
              return (
                <div className={`card ${overheadTotal > 0 ? "bg-purple-50 border border-purple-200" : ""}`}>
                  <div className="text-xs text-gray-500">🧾 نثريات</div>
                  <div className="font-bold text-purple-700">{formatCurrency(overheadTotal)}</div>
                </div>
              );
            })()}
            {/* تكاليف إضافية أخرى */}
            {(() => {
              const otherItems = extraCosts.filter((e: any) => !['نثريات', 'مصاريف دهانات', 'دهانات', 'مصاريف ليد', 'ليد'].includes(e.cost_type));
              const otherTotal = otherItems.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
              return (
                <div className={`card ${otherTotal > 0 ? "bg-brand-orange-light border border-brand-orange/20" : ""}`}>
                  <div className="text-xs text-gray-500">تكاليف إضافية أخرى</div>
                  <div className="font-bold">{formatCurrency(otherTotal)}</div>
                </div>
              );
            })()}
            <div className={`card ${external.length > 0 ? "bg-brand-orange-light border border-brand-orange/20" : ""}`}><div className="text-xs text-gray-500">أعمال خارجية</div><div className="font-bold">{formatCurrency(external.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0))}</div></div>
            <div className="card bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white md:col-span-4"><div className="text-xs opacity-90">الإجمالي الشامل للتكاليف والأجور</div><div className="font-extrabold text-lg">{formatCurrency(costs.order_total)}</div></div>
          </div>

          {/* تفاصيل التكاليف الإضافية (دهانات، ليد، وغيرها) */}
          {extraCosts.filter((e: any) => e.cost_type !== 'نثريات').length > 0 && (
            <div className="card mb-4 border-purple-200">
              <h4 className="font-bold text-sm mb-3 text-purple-900">🎨💡 تفاصيل مصاريف الدهانات والليد والتكاليف الإضافية</h4>
              <div className="divide-y border rounded-lg overflow-hidden text-sm">
                {extraCosts.filter((e: any) => e.cost_type !== 'نثريات').map((e: any) => (
                  <div key={e.id} className="flex justify-between items-center px-3 py-2 hover:bg-purple-50/50">
                    <div>
                      <span className="font-bold text-gray-800">{e.cost_type}</span>
                      {e.notes ? <span className="text-gray-600 mr-2">— {e.notes}</span> : ""}
                    </div>
                    <strong className="text-purple-800">{formatCurrency(Number(e.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* قسم نثريات الأوردر */}
          <div className="card mb-4 border-yellow-200">
            <h4 className="font-bold text-sm mb-3">🧾 نثريات الأوردر</h4>
            {extraCosts.filter((e: any) => e.cost_type === 'نثريات').length > 0 && (
              <div className="mb-3 divide-y border rounded-lg overflow-hidden text-sm">
                {extraCosts.filter((e: any) => e.cost_type === 'نثريات').map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between px-3 py-2 hover:bg-yellow-50">
                    <span className="text-gray-700">{e.notes || "—"}</span>
                    <div className="flex items-center gap-3">
                      <strong className="text-yellow-700">{formatCurrency(Number(e.amount))}</strong>
                      {isAdmin && (
                        <button
                          onClick={() => deleteOverhead(e.id)}
                          className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition"
                        >🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <form onSubmit={addOverhead} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="البيان"
                    value={overheadDesc}
                    onChange={e => setOverheadDesc(e.target.value)}
                    placeholder="مثال: كهرباء، شحن..."
                    required
                  />
                </div>
                <div className="w-32">
                  <Input
                    label="المبلغ"
                    type="number"
                    step="0.01"
                    value={overheadAmount}
                    onChange={e => setOverheadAmount(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" loading={overheadSaving} variant="secondary" size="sm">
                  ➕ إضافة
                </Button>
              </form>
            )}
          </div>

          {/* يوميات العمال المسجلة للأوردر */}
          {workerLogs.length > 0 && (
            <div className="card mb-4 border-orange-200">
              <h4 className="font-bold text-sm mb-3 text-orange-800">🧑‍🔧 يوميات العمال على هذا الأوردر</h4>
              <div className="divide-y border rounded-lg overflow-hidden text-sm">
                {workerLogs.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 hover:bg-orange-50/50">
                    <div>
                      <span className="font-bold text-gray-800">{l.worker_name || "عامل"}</span>
                      <span className="text-xs text-gray-500 mr-2">({formatDate(l.work_date)})</span>
                      {l.is_travel && <span className="badge bg-amber-100 text-amber-800 mr-2">✈️ سفر</span>}
                    </div>
                    <strong className="text-orange-700">{formatCurrency(Number(l.daily_rate))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* مصاريف الطريق المسجلة للأوردر */}
          {roadExpenses.length > 0 && (
            <div className="card mb-4 border-amber-200">
              <h4 className="font-bold text-sm mb-3 text-amber-800">🛣️ مصاريف الطريق الخاصة بالأوردر</h4>
              <div className="divide-y border rounded-lg overflow-hidden text-sm">
                {roadExpenses.map((re: any) => (
                  <div key={re.id} className="flex items-center justify-between px-3 py-2 hover:bg-amber-50/50">
                    <div>
                      <span className="text-gray-800">{re.description || re.notes || "مصروف طريق"}</span>
                      <span className="text-xs text-gray-500 mr-2">({formatDate(re.expense_date)})</span>
                    </div>
                    <strong className="text-amber-700">{formatCurrency(Number(re.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* الأعمال الخارجية — داخل إجمالي الأوردر */}
      <h3 className="font-bold text-lg mt-6 mb-3">🔨 أعمال خارجية</h3>
      <DataTable
        rows={external as any[]}
        emptyMessage="لا توجد أعمال خارجية"
        columns={[
          { key: "type", label: "النوع", render: (r: any) => r.work_type },
          { key: "contractor", label: "المقاول", render: (r: any) => r.contractor_name ?? r.mazaya_contractors?.name ?? "—" },
          { key: "amount", label: "القيمة", render: (r: any) => formatCurrency(r.amount) },
          { key: "notes", label: "ملاحظات" },
        ]}
      />
      {external.length > 0 && (
        <div className="mt-2 text-sm flex justify-between max-w-md mr-auto">
          <span className="text-gray-500">إجمالي الأعمال الخارجية:</span>
          <strong>{formatCurrency(external.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0))}</strong>
        </div>
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
