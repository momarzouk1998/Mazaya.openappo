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
      fetch(`/api/orders/${id}/materials`).then((r) => r.json()),
      fetch(`/api/orders/${id}`).then((r) => r.json()),
      fetch(`/api/orders/${id}/external-work`).then((r) => r.json()),
      fetch(`/api/orders/${id}/extra-costs`).then((r) => r.json()),
    ]).then(([mRes, cRes, eRes, exRes]) => {
      setMaterials(mRes?.data ?? []);
      setCosts(cRes?.data ?? null);
      setExternal(eRes?.data ?? []);
      setExtraCosts(exRes?.data ?? []);
    });
  }, [order?.id, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8 font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-md">
          <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <span>جاري تحميل الفاتورة...</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">الأوردر غير موجود</h2>
          <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">رجوع</button>
        </div>
      </div>
    );
  }

  const boardsCost = Number(costs?.boards_cost ?? 0);
  const accCost = Number(costs?.accessories_cost ?? 0);
  const materialsCost = materials?.reduce((s: number, m: any) => s + Number(m.line_total ?? 0), 0) || 0;
  const extraCostsSum = extraCosts?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;
  const externalWorkSum = external?.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) || 0;
  const grandTotal =
    Number(costs?.order_total ?? 0) ||
    materialsCost +
      Number(costs?.installation_cost ?? 0) +
      Number(costs?.internal_transport_cost ?? 0) +
      Number(costs?.external_transport_cost ?? 0) +
      Number(costs?.factory_commission ?? 0) +
      extraCostsSum +
      externalWorkSum;

  const printDateStr = formatDate(new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:p-0 print:bg-white font-sans text-gray-900 dir-rtl">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl print:shadow-none p-6 sm:p-10 print:p-6 border border-gray-100 print:border-none">
        
        {/* Invoice Top Branding Header */}
        <div className="flex items-start justify-between border-b-2 border-brand-orange pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-brand-orange">مزايا</span>
              <h1 className="text-2xl font-black text-gray-900">مصنع مزايا للأثاث</h1>
            </div>
            <p className="text-xs text-gray-500 font-semibold tracking-wider mt-1">MAZAYA FURNITURE FACTORY</p>
            <p className="text-xs text-gray-400 mt-0.5">دمياط - مصر • تصميم وتصنيع كافة أنواع الأثاث والديكور</p>
          </div>

          <div className="text-left">
            <div className="inline-block bg-brand-orange/10 text-brand-orange-dark px-4 py-1.5 rounded-lg text-lg font-black print:bg-transparent print:p-0 print:text-black">
              فاتورة أوردر #ORD-{order.id}
            </div>
            <div className="text-xs text-gray-500 mt-2 font-medium">تاريخ الأوردر: {formatDate(order.start_date)}</div>
            <div className="text-xs text-gray-400 mt-0.5">تاريخ الطباعة: {printDateStr}</div>
          </div>
        </div>

        {/* Order & Customer Metadata Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Customer Info */}
          <div className="bg-gray-50 print:bg-gray-50/50 p-4 rounded-xl border border-gray-200/80">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">بيانات العميل</div>
            <div className="text-base font-extrabold text-gray-900">{order.customer_name || "—"}</div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              {order.customer_phone && <div>📞 الهاتف: <span className="font-semibold text-gray-800">{order.customer_phone}</span></div>}
              {order.customer_address && <div>📍 العنوان: <span className="font-semibold text-gray-800">{order.customer_address}</span></div>}
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-gray-50 print:bg-gray-50/50 p-4 rounded-xl border border-gray-200/80">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">تفاصيل الطلب</div>
            <div className="text-base font-extrabold text-gray-900">{order.order_name}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>المعرض: <span className="font-semibold text-gray-800">{order.branch_name || "—"}</span></div>
              <div>النوع: <span className="font-semibold text-gray-800">{ORDER_TYPE_LABELS[order.order_type] || order.order_type}</span></div>
              <div>الحالة: <span className="font-semibold text-gray-800">{STATUS_LABELS[order.status] || order.status}</span></div>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="mb-6 p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg text-xs text-amber-900">
            📌 <strong>ملاحظات الأوردر:</strong> {order.notes}
          </div>
        )}

        {/* Section: Materials Table */}
        {materials && materials.length > 0 && (
          <div className="mb-6 break-inside-avoid">
            <h3 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-1">
              <span>📦</span>
              <span>المواد والأصناف المستخدمة</span>
            </h3>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 print:bg-gray-200 text-gray-800 font-bold border-b border-gray-200">
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5 w-24">الكود</th>
                    <th className="p-2.5 text-center w-20">الكمية</th>
                    <th className="p-2.5 text-left w-28">السعر</th>
                    <th className="p-2.5 text-left w-32">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {materials.map((m: any, idx: number) => (
                    <tr key={m.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="p-2.5 font-medium text-gray-900">{m.item_name}</td>
                      <td className="p-2.5 font-mono text-xs text-gray-500">{m.item_code || "—"}</td>
                      <td className="p-2.5 text-center font-semibold">{m.quantity_used}</td>
                      <td className="p-2.5 text-left">{formatCurrency(m.unit_price_snapshot)}</td>
                      <td className="p-2.5 text-left font-bold text-gray-900">{formatCurrency(m.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Costs Breakdown */}
        <div className="mb-6 break-inside-avoid">
          <h3 className="font-bold text-sm text-gray-800 mb-2 flex items-center gap-1">
            <span>💵</span>
            <span>تفاصيل التكاليف والخدمات</span>
          </h3>
          <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-200 text-xs sm:text-sm">
            <div className="p-3 bg-white flex justify-between items-center">
              <span className="text-gray-600">تكلفة الألواح:</span>
              <span className="font-bold text-gray-900">{formatCurrency(boardsCost)}</span>
            </div>
            <div className="p-3 bg-gray-50/50 flex justify-between items-center">
              <span className="text-gray-600">تكلفة الاكسسوارات:</span>
              <span className="font-bold text-gray-900">{formatCurrency(accCost)}</span>
            </div>
            {Number(costs?.installation_cost || 0) > 0 && (
              <div className="p-3 bg-white flex justify-between items-center">
                <span className="text-gray-600">
                  تكلفة التركيبات {costs?.installation_travel_days > 0 ? `(${costs.installation_travel_days} أيام سفر)` : ""}:
                </span>
                <span className="font-bold text-gray-900">{formatCurrency(costs?.installation_cost)}</span>
              </div>
            )}
            {Number(costs?.internal_transport_cost || 0) > 0 && (
              <div className="p-3 bg-gray-50/50 flex justify-between items-center">
                <span className="text-gray-600">نقل داخلي:</span>
                <span className="font-bold text-gray-900">{formatCurrency(costs?.internal_transport_cost)}</span>
              </div>
            )}
            {Number(costs?.external_transport_cost || 0) > 0 && (
              <div className="p-3 bg-white flex justify-between items-center">
                <span className="text-gray-600">نقل خارجي:</span>
                <span className="font-bold text-gray-900">{formatCurrency(costs?.external_transport_cost)}</span>
              </div>
            )}
            {Number(costs?.factory_commission || 0) > 0 && (
              <div className="p-3 bg-gray-50/50 flex justify-between items-center">
                <span className="text-gray-600">عمولة المصنع:</span>
                <span className="font-bold text-gray-900">{formatCurrency(costs?.factory_commission)}</span>
              </div>
            )}

            {extraCosts && extraCosts.length > 0 && (
              <div className="p-3 bg-amber-50/40">
                <div className="font-semibold text-gray-700 mb-1.5">تكاليف إضافية:</div>
                <div className="space-y-1.5">
                  {extraCosts.map((e: any) => (
                    <div key={e.id} className="flex justify-between text-xs text-gray-600">
                      <span>• {e.cost_type}{e.notes ? ` (${e.notes})` : ""}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {external && external.length > 0 && (
              <div className="p-3 bg-blue-50/40">
                <div className="font-semibold text-gray-700 mb-1.5">أعمال خارجية (مقاولون):</div>
                <div className="space-y-1.5">
                  {external.map((e: any) => (
                    <div key={e.id} className="flex justify-between text-xs text-gray-600">
                      <span>• {e.work_type}{e.contractor_name ? ` (${e.contractor_name})` : ""}{e.notes ? ` — ${e.notes}` : ""}:</span>
                      <span className="font-bold text-gray-800">{formatCurrency(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Total Highlight Card */}
        <div className="bg-gradient-to-l from-gray-900 via-gray-800 to-gray-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-lg mb-8 print:bg-none print:text-black print:border-2 print:border-gray-900">
          <div>
            <span className="text-xs text-gray-300 print:text-gray-700 block font-medium">الإجمالي الكلي المستحق</span>
            <span className="text-xs text-gray-400 print:text-gray-500">يشمل كافة التكاليف والمواد المذكورة</span>
          </div>
          <span className="text-3xl font-black text-amber-400 print:text-black">{formatCurrency(grandTotal)}</span>
        </div>

        {/* Signatures & Approvals */}
        <div className="pt-6 border-t border-gray-200 grid grid-cols-3 gap-6 text-center text-xs text-gray-600 break-inside-avoid">
          <div>
            <div className="font-bold text-gray-800 mb-8">إعداد وتدقيق</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
          <div>
            <div className="font-bold text-gray-800 mb-8">اعتماد المصنع</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
          <div>
            <div className="font-bold text-gray-800 mb-8">توقيع العميل / المستلم</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-center text-[11px] text-gray-400">
          <p>مصنع مزايا للأثاث - Mazaya Furniture Factory</p>
          <p>شكراً لتعاملكم معنا • حررت الفاتورة إلكترونياً بتاريخ {printDateStr}</p>
        </div>

        {/* Print Buttons */}
        <div className="mt-8 pt-4 border-t flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold rounded-xl shadow-lg transition-all"
          >
            <span>🖨️</span>
            <span>طباعة الفاتورة / حفظ PDF</span>
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
          >
            رجوع
          </button>
        </div>

      </div>
    </div>
  );
}
