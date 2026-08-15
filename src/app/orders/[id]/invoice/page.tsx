"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate, STATUS_LABELS, ORDER_TYPE_LABELS } from "@/lib/format";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { data: orderData, loading } = useApi<any>(`/api/orders/${id}`);
  const order = orderData?.data ?? orderData;

  const [materials, setMaterials] = useState<any[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [external, setExternal] = useState<any[]>([]);
  const [extraCosts, setExtraCosts] = useState<any[]>([]);
  const [workerLogs, setWorkerLogs] = useState<any[]>([]);
  const [roadExpenses, setRoadExpenses] = useState<any[]>([]);

  // Fetch related data when order loads
  useEffect(() => {
    if (!order?.id) return;
    Promise.all([
      fetch(`/api/orders/${id}/materials`).then(r => r.json()),
      fetch(`/api/orders/${id}`).then(r => r.json()),
      fetch(`/api/orders/${id}/external-work`).then(r => r.json()),
      fetch(`/api/orders/${id}/extra-costs`).then(r => r.json()),
    ]).then(([mRes, cRes, eRes, exRes]) => {
      setMaterials(mRes?.data ?? []);
      const cData = cRes?.data ?? null;
      setCosts(cData);
      setExternal(eRes?.data ?? cData?.external_work ?? []);
      setExtraCosts(exRes?.data ?? cData?.extra_costs ?? []);
      setWorkerLogs(cData?.worker_logs ?? []);
      setRoadExpenses(cData?.road_expenses ?? []);
    });
  }, [order?.id, id]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-8 text-center">الأوردر غير موجود</div>;

  const boardsCost = Number(costs?.boards_cost ?? 0);
  const accCost = Number(costs?.accessories_cost ?? 0);
  const installationCost = Number(costs?.installation_cost ?? 0);
  const internalTransportCost = Number(costs?.internal_transport_cost ?? 0);
  const externalTransportCost = Number(costs?.external_transport_cost ?? 0);
  const factoryCommission = Number(costs?.factory_commission ?? 0);
  const workerLogsTotal = Number(costs?.worker_logs_total ?? 0);
  const roadExpensesTotal = Number(costs?.road_expenses_total ?? 0);

  const materialsCost = materials?.reduce((s: number, m: any) => s + Number(m.line_total ?? 0), 0) || 0;
  const extraCostsSum = extraCosts?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;
  const externalWorkSum = external?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;

  const grandTotal = Number(costs?.order_total ?? 0) || (
    boardsCost +
    accCost +
    installationCost +
    internalTransportCost +
    externalTransportCost +
    factoryCommission +
    workerLogsTotal +
    roadExpensesTotal +
    extraCostsSum +
    externalWorkSum
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none rounded-2xl p-8 print:p-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-orange pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-black">مصنع مزايا للأثاث</h1>
            <p className="text-sm text-gray-500">Mazaya Furniture Factory</p>
            <p className="text-xs text-gray-400 mt-1">دمياط - مصر</p>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold text-brand-orange">فاتورة تكاليف الأوردر الشاملة</div>
            <div className="text-sm text-gray-500 mt-1">رقم الأوردر: #{order.id}</div>
            <div className="text-sm text-gray-500">{formatDate(order.start_date)}</div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">العميل</div>
            <div className="font-bold text-base text-gray-900">{order.customer_name || "—"}</div>
            {order.customer_phone && <div className="text-xs text-gray-600 mt-1">📞 {order.customer_phone}</div>}
            {order.customer_address && <div className="text-xs text-gray-600 mt-0.5">📍 {order.customer_address}</div>}
          </div>
          <div className="text-left">
            <div className="text-xs text-gray-500 uppercase font-semibold">المعرض / الفرع</div>
            <div className="font-bold text-base text-gray-900">{order.branch_name || "—"}</div>
            <div className="text-xs text-gray-600 mt-1">
              <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">{ORDER_TYPE_LABELS[order.order_type] || order.order_type}</span>
              {" • "}
              <span className="inline-block px-2 py-0.5 rounded bg-gray-200 text-gray-800">{STATUS_LABELS[order.status] || order.status}</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="text-xl font-extrabold text-brand-black">أوردر: {order.order_name}</div>
          {order.notes && <div className="text-sm text-gray-500 mt-1">{order.notes}</div>}
        </div>

        {/* Materials */}
        {materials && materials.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-base mb-2 border-b pb-1 text-gray-800 flex items-center gap-2">
              <span>📋</span>
              <span>المواد والخامات المستخدمة (ألواح وإكسسوارات)</span>
            </h3>
            <table className="w-full text-sm mb-2 border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs">
                  <th className="p-2 text-right">الصنف</th>
                  <th className="p-2 text-right">الكود</th>
                  <th className="p-2 text-center">الكمية</th>
                  <th className="p-2 text-left">سعر الوحدة</th>
                  <th className="p-2 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m: any) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-2 font-medium">{m.item_name}</td>
                    <td className="p-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{m.item_code ?? "—"}</code></td>
                    <td className="p-2 text-center">{m.quantity_used}</td>
                    <td className="p-2 text-left">{formatCurrency(m.unit_price_snapshot)}</td>
                    <td className="p-2 text-left font-bold text-gray-800">{formatCurrency(m.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed Cost Breakdown Table */}
        <h3 className="font-bold text-base mb-3 border-b pb-1 text-gray-800 flex items-center gap-2">
          <span>💰</span>
          <span>تفاصيل بيان التكاليف والمصاريف الشاملة</span>
        </h3>
        <div className="space-y-2 text-sm mb-6 border rounded-xl p-4 bg-gray-50/50">
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🪵 تكلفة الألواح:</span>
            <strong>{formatCurrency(boardsCost)}</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🔩 تكلفة الاكسسوارات:</span>
            <strong>{formatCurrency(accCost)}</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🛠️ تكلفة التركيبات:</span>
            <strong>{formatCurrency(installationCost)}</strong>
          </div>
          {costs?.installation_travel_days > 0 && (
            <div className="flex justify-between py-1 border-b border-gray-200 text-gray-500 text-xs">
              <span>✈️ أيام سفر التركيب:</span>
              <span>{costs.installation_travel_days} يوم</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🚚 النقل الداخلي:</span>
            <strong>{formatCurrency(internalTransportCost)}</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🚛 النقل الخارجي:</span>
            <strong>{formatCurrency(externalTransportCost)}</strong>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span>🏭 عمولة المصنع:</span>
            <strong>{formatCurrency(factoryCommission)}</strong>
          </div>

          {/* مصاريف الطريق والنقل */}
          {roadExpensesTotal > 0 && (
            <div className="border-t border-amber-200 pt-2 mt-2">
              <div className="flex justify-between font-bold text-amber-900">
                <span>🛣️ مصاريف الطريق والانتقالات:</span>
                <span>{formatCurrency(roadExpensesTotal)}</span>
              </div>
              {roadExpenses && roadExpenses.length > 0 && (
                <div className="mr-4 mt-1 space-y-1 text-xs text-amber-800">
                  {roadExpenses.map((re: any) => (
                    <div key={re.id} className="flex justify-between py-0.5 border-b border-amber-100 last:border-0">
                      <span>• {re.description || re.notes || "مصروف طريق"} ({formatDate(re.expense_date)})</span>
                      <strong className="font-semibold">{formatCurrency(Number(re.amount))}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* أجور العمال - يوميات */}
          {workerLogsTotal > 0 && (
            <div className="border-t border-orange-200 pt-2 mt-2">
              <div className="flex justify-between font-bold text-orange-900">
                <span>🧑‍🔧 أجور العمال (يوميات الأوردر):</span>
                <span>{formatCurrency(workerLogsTotal)}</span>
              </div>
              {workerLogs && workerLogs.length > 0 && (
                <div className="mr-4 mt-1 space-y-1 text-xs text-orange-800">
                  {workerLogs.map((wl: any) => (
                    <div key={wl.id} className="flex justify-between py-0.5 border-b border-orange-100 last:border-0">
                      <span>• {wl.worker_name || "عامل"} — يومية بتاريخ ({formatDate(wl.work_date)}) {wl.is_travel ? "✈️ سفر" : ""}</span>
                      <strong className="font-semibold">{formatCurrency(Number(wl.daily_rate))}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* التكاليف الإضافية (دهانات، ليد، نثريات) */}
          {extraCosts && extraCosts.length > 0 && (
            <div className="border-t border-purple-200 pt-2 mt-2">
              <div className="flex justify-between font-bold text-purple-900">
                <span>➕ التكاليف الإضافية (الدهانات والليد والنثريات):</span>
                <span>{formatCurrency(extraCostsSum)}</span>
              </div>
              <div className="mr-4 mt-1 space-y-1 text-xs text-purple-800">
                {extraCosts.map((e: any) => (
                  <div key={e.id} className="flex justify-between py-0.5 border-b border-purple-100 last:border-0">
                    <span>
                      • <strong className="font-bold">{e.cost_type}</strong>
                      {e.notes ? ` — ${e.notes}` : ""}
                    </span>
                    <strong className="font-semibold">{formatCurrency(Number(e.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* الأعمال الخارجية */}
          {external && external.length > 0 && (
            <div className="border-t border-indigo-200 pt-2 mt-2">
              <div className="flex justify-between font-bold text-indigo-900">
                <span>🔨 الأعمال الخارجية للمقاولين:</span>
                <span>{formatCurrency(externalWorkSum)}</span>
              </div>
              <div className="mr-4 mt-1 space-y-1 text-xs text-indigo-800">
                {external.map((e: any) => (
                  <div key={e.id} className="flex justify-between py-0.5 border-b border-indigo-100 last:border-0">
                    <span>
                      • <strong className="font-bold">{e.work_type}</strong>
                      {e.contractor_name ? ` (${e.contractor_name})` : ""}
                      {e.notes ? ` — ${e.notes}` : ""}
                    </span>
                    <strong className="font-semibold">{formatCurrency(Number(e.amount))}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Total Banner */}
        <div className="bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white p-5 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="font-bold text-lg block">الإجمالي الشامل لتكاليف الأوردر</span>
            <span className="text-xs opacity-80 block mt-0.5">يشمل الألواح، الاكسسوارات، التركيبات، النقل، مصاريف الطريق، أجور العمال، الدهانات، الليد، والأعمال الخارجية</span>
          </div>
          <span className="text-3xl font-extrabold">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
          <p>مصنع مزايا للأثاث - Mazaya Furniture Factory</p>
          <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</p>
        </div>

        <div className="mt-6 flex gap-2 justify-center print:hidden">
          <button onClick={() => window.print()} className="btn-primary">🖨️ طباعة الفاتورة الشاملة</button>
          <button onClick={() => window.history.back()} className="btn-secondary">رجوع</button>
        </div>
      </div>
    </div>
  );
}
