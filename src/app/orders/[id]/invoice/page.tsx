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
      // costs come directly on data (not data.costs)
      setCosts(cRes?.data ?? null);
      setExternal(eRes?.data ?? []);
      setExtraCosts(exRes?.data ?? []);
    });
  }, [order?.id, id]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!order) return <div className="p-8 text-center">الأوردر غير موجود</div>;

  const boardsCost = Number(costs?.boards_cost ?? 0);
  const accCost = Number(costs?.accessories_cost ?? 0);
  const materialsCost = materials?.reduce((s: number, m: any) => s + Number(m.line_total ?? 0), 0) || 0;
  const extraCostsSum = extraCosts?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;
  const externalWorkSum = external?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;
  const grandTotal = Number(costs?.order_total ?? 0) || (
    materialsCost +
    Number(costs?.installation_cost ?? 0) +
    Number(costs?.internal_transport_cost ?? 0) +
    Number(costs?.external_transport_cost ?? 0) +
    Number(costs?.factory_commission ?? 0) +
    extraCostsSum +
    externalWorkSum
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none rounded-2xl p-8 print:p-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-orange pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-black">مصنع مزايا</h1>
            <p className="text-sm text-gray-500">Mazaya Furniture Factory</p>
            <p className="text-xs text-gray-400 mt-1">دمياط - مصر</p>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold text-brand-orange">فاتورة أوردر</div>
            <div className="text-sm text-gray-500 mt-1">رقم: #{order.id}</div>
            <div className="text-sm text-gray-500">{formatDate(order.start_date)}</div>
          </div>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-xs text-gray-500 uppercase">العميل</div>
            <div className="font-bold">{order.customer_name || "—"}</div>
            {order.customer_phone && <div className="text-sm text-gray-600">📞 {order.customer_phone}</div>}
            {order.customer_address && <div className="text-sm text-gray-600">📍 {order.customer_address}</div>}
          </div>
          <div className="text-left">
            <div className="text-xs text-gray-500 uppercase">المعرض</div>
            <div className="font-bold">{order.branch_name || "—"}</div>
            <div className="text-sm text-gray-600 mt-2">{ORDER_TYPE_LABELS[order.order_type]} • {STATUS_LABELS[order.status]}</div>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="text-xl font-extrabold text-brand-black">أوردر: {order.order_name}</div>
          {order.notes && <div className="text-sm text-gray-500 mt-2">{order.notes}</div>}
        </div>

        {/* Materials */}
        <h3 className="font-bold text-lg mb-3 border-b pb-2">المواد المستخدمة</h3>
        <table className="w-full text-sm mb-6">
          <thead><tr className="bg-gray-100">
            <th className="p-2 text-right">الصنف</th>
            <th className="p-2 text-right">الكود</th>
            <th className="p-2 text-center">الكمية</th>
            <th className="p-2 text-left">السعر</th>
            <th className="p-2 text-left">الإجمالي</th>
          </tr></thead>
          <tbody>
            {(materials ?? []).map((m: any) => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.item_name}</td>
                <td className="p-2"><code className="text-xs">{m.item_code ?? ""}</code></td>
                <td className="p-2 text-center">{m.quantity_used}</td>
                <td className="p-2 text-left">{formatCurrency(m.unit_price_snapshot)}</td>
                <td className="p-2 text-left font-bold">{formatCurrency(m.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Costs */}
        <h3 className="font-bold text-lg mb-3 border-b pb-2">التكاليف</h3>
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between"><span>تكلفة الألواح:</span><strong>{formatCurrency(boardsCost)}</strong></div>
          <div className="flex justify-between"><span>تكلفة الاكسسوارات:</span><strong>{formatCurrency(accCost)}</strong></div>
          <div className="flex justify-between"><span>تكلفة التركيبات:</span><strong>{formatCurrency(costs?.installation_cost)}</strong></div>
          {costs?.installation_travel_days > 0 && <div className="flex justify-between text-gray-500"><span>أيام سفر التركيب:</span><span>{costs.installation_travel_days} يوم</span></div>}
          <div className="flex justify-between"><span>نقل داخلي:</span><strong>{formatCurrency(costs?.internal_transport_cost)}</strong></div>
          <div className="flex justify-between"><span>نقل خارجي:</span><strong>{formatCurrency(costs?.external_transport_cost)}</strong></div>
          <div className="flex justify-between"><span>عمولة المصنع:</span><strong>{formatCurrency(costs?.factory_commission)}</strong></div>
          {extraCosts && extraCosts.length > 0 && (
            <>
              <div className="border-t pt-2 mt-2 font-semibold">تكاليف إضافية:</div>
              {extraCosts.map((e: any) => (
                <div key={e.id} className="flex justify-between text-gray-600">
                  <span>{e.cost_type}{e.notes ? ` (${e.notes})` : ""}:</span>
                  <strong>{formatCurrency(Number(e.amount))}</strong>
                </div>
              ))}
            </>
          )}
          {external && external.length > 0 && (
            <>
              <div className="border-t pt-2 mt-2 font-semibold">أعمال خارجية:</div>
              {external.map((e: any) => (
                <div key={e.id} className="flex justify-between text-gray-600">
                  <span>{e.work_type}{e.contractor_name ? ` (${e.contractor_name})` : ""}{e.notes ? ` — ${e.notes}` : ""}:</span>
                  <strong>{formatCurrency(Number(e.amount))}</strong>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white p-4 rounded-xl flex items-center justify-between">
          <span className="font-bold">الإجمالي الكلي</span>
          <span className="text-2xl font-extrabold">{formatCurrency(grandTotal)}</span>
        </div>

        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
          <p>مصنع مزايا للأثاث - Mazaya Furniture Factory</p>
          <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</p>
        </div>

        <div className="mt-6 flex gap-2 justify-center print:hidden">
          <button onClick={() => window.print()} className="btn-primary">🖨️ طباعة</button>
          <button onClick={() => window.history.back()} className="btn-secondary">رجوع</button>
        </div>
      </div>
    </div>
  );
}
