"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate, ORDER_TYPE_LABELS } from "@/lib/format";

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>();

  const { data: customerData, loading: loadingCustomer } = useApi<any>(`/api/customers/${id}`);
  const customer = customerData?.data ?? customerData;

  const { data: ordersRes, loading: loadingOrders } = useApi<{ items: any[] }>(`/api/orders?limit=500&customer_id=${id}`);
  const { data: paymentsRes, loading: loadingPayments } = useApi<{ items: any[] }>(`/api/customer-payments?customer_id=${id}`);

  const orders = ordersRes?.items ?? [];
  const payments = paymentsRes?.items ?? [];

  // Build merged chronological statement ledger entries
  const statementEntries = useMemo(() => {
    const combined: Array<{
      id: string;
      date: string;
      rawDate: Date;
      type: "order" | "payment";
      title: string;
      details: string;
      debit: number;  // تكلفة أوردر
      credit: number; // دفعة مسددة
    }> = [];

    orders.forEach((o: any) => {
      combined.push({
        id: `ord-${o.id}`,
        date: o.start_date ? o.start_date.slice(0, 10) : "",
        rawDate: new Date(o.start_date || o.created_at || Date.now()),
        type: "order",
        title: `أوردر: ${o.order_name}`,
        details: `${ORDER_TYPE_LABELS[o.order_type] || o.order_type || "أوردر"} ${o.branch_name ? `• ${o.branch_name}` : ""}`,
        debit: Number(o.total || 0),
        credit: 0,
      });
    });

    payments.forEach((p: any) => {
      combined.push({
        id: `pay-${p.id}`,
        date: p.date ? p.date.slice(0, 10) : "",
        rawDate: new Date(p.date || p.created_at || Date.now()),
        type: "payment",
        title: `سداد دفعة نقدية`,
        details: `${p.payment_method || "نقدي"} ${p.notes ? `(${p.notes})` : ""} ${p.order?.order_name ? `• أوردر: ${p.order.order_name}` : ""}`,
        debit: 0,
        credit: Number(p.amount || 0),
      });
    });

    // Sort by date ascending
    combined.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Compute running balance
    let currentBalance = 0;
    return combined.map((entry) => {
      currentBalance += entry.debit - entry.credit;
      return {
        ...entry,
        balance: currentBalance,
      };
    });
  }, [orders, payments]);

  const totalCost = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const finalBalance = totalCost - totalPaid;

  const loading = loadingCustomer || loadingOrders || loadingPayments;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-500 font-sans">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-md">
          <div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
          <span>جاري تحميل كشف الحساب...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-500 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">العميل غير موجود</h2>
          <p className="text-sm text-gray-500 mb-4">لم نتمكن من العثور على بيانات هذا العميل.</p>
          <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">رجوع</button>
        </div>
      </div>
    );
  }

  const todayStr = formatDate(new Date().toISOString());

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 print:p-0 print:bg-white font-sans text-gray-900 dir-rtl">
      {/* Container */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl print:shadow-none p-6 sm:p-10 print:p-6 border border-gray-100 print:border-none">
        
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b-2 border-brand-orange/80 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-brand-orange">مزايا</span>
              <h1 className="text-2xl font-black text-gray-900">مصنع مزايا للأثاث</h1>
            </div>
            <p className="text-xs text-gray-500 font-semibold tracking-wider mt-1">MAZAYA FURNITURE FACTORY</p>
            <p className="text-xs text-gray-400 mt-0.5">دمياط - المنطقة الصناعية • هاتف: 01000000000</p>
          </div>

          <div className="text-left">
            <div className="inline-block bg-brand-orange/10 text-brand-orange-dark px-4 py-1.5 rounded-lg text-lg font-bold print:bg-transparent print:p-0 print:text-black">
              كشف حساب عميل
            </div>
            <div className="text-xs text-gray-500 mt-2 font-medium">تاريخ الاصدار: {todayStr}</div>
            <div className="text-xs text-gray-400 mt-0.5">عدد الحركات: {statementEntries.length}</div>
          </div>
        </div>

        {/* Customer & Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Customer Info Card */}
          <div className="md:col-span-2 bg-gray-50 print:bg-gray-50/50 p-4 rounded-xl border border-gray-200/80">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">بيانات العميل</div>
            <div className="text-lg font-extrabold text-gray-900">{customer.name}</div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
              <div>📞 الهاتف: <span className="font-semibold text-gray-800">{customer.phone || "—"}</span></div>
              <div>🏢 المعرض/الفرع: <span className="font-semibold text-gray-800">{customer.branch_name || "—"}</span></div>
              {customer.address && <div className="col-span-2">📍 العنوان: <span className="font-semibold text-gray-800">{customer.address}</span></div>}
            </div>
          </div>

          {/* Balance Cards Summary */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 rounded-xl flex flex-col justify-between shadow-sm print:bg-none print:text-black print:border print:border-gray-300">
            <div>
              <div className="text-xs text-gray-300 print:text-gray-600 font-medium">صافي المتبقي المستحق</div>
              <div className={`text-2xl font-black mt-1 ${finalBalance > 0 ? "text-amber-400 print:text-black" : "text-emerald-400 print:text-black"}`}>
                {formatCurrency(finalBalance)}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-700/60 print:border-gray-300 text-xs flex justify-between text-gray-300 print:text-gray-700">
              <span>إجمالي الأوردرات: <strong>{formatCurrency(totalCost)}</strong></span>
              <span>المسدد: <strong>{formatCurrency(totalPaid)}</strong></span>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="mb-8 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-200 text-gray-800 font-bold border-b border-gray-200">
                <th className="p-3 w-24">التاريخ</th>
                <th className="p-3">البيان والتفاصيل</th>
                <th className="p-3 text-left w-28">مطلوب (عليكم)</th>
                <th className="p-3 text-left w-28">مسدد (لكم)</th>
                <th className="p-3 text-left w-32 bg-gray-200/60 print:bg-gray-300">الرصيد المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {statementEntries.length > 0 ? (
                statementEntries.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="p-3 text-gray-600 font-mono text-xs">{row.date || "—"}</td>
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{row.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{row.details}</div>
                    </td>
                    <td className="p-3 text-left font-semibold text-gray-900">
                      {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                    </td>
                    <td className="p-3 text-left font-semibold text-emerald-700 print:text-black">
                      {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                    </td>
                    <td className="p-3 text-left font-extrabold text-gray-900 bg-gray-50 print:bg-transparent">
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    لا توجد حركات سابقة لهذا العميل
                  </td>
                </tr>
              )}
            </tbody>
            {statementEntries.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 print:bg-gray-200 font-extrabold text-gray-900 border-t-2 border-gray-300">
                  <td colSpan={2} className="p-3 text-right">الإجماليات النهائيــة</td>
                  <td className="p-3 text-left text-gray-900">{formatCurrency(totalCost)}</td>
                  <td className="p-3 text-left text-emerald-700 print:text-black">{formatCurrency(totalPaid)}</td>
                  <td className="p-3 text-left text-base text-brand-orange-dark print:text-black bg-gray-200/80">
                    {formatCurrency(finalBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Notes & Signatures */}
        <div className="pt-6 border-t border-gray-200 grid grid-cols-3 gap-6 text-center text-xs text-gray-600">
          <div>
            <div className="font-bold text-gray-800 mb-8">إعداد الحسابات</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
          <div>
            <div className="font-bold text-gray-800 mb-8">اعتماد إدارة المصنع</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
          <div>
            <div className="font-bold text-gray-800 mb-8">توقيع العميل بالاستلام</div>
            <div className="border-b border-dashed border-gray-300 w-3/4 mx-auto"></div>
          </div>
        </div>

        {/* System Footer Note */}
        <div className="mt-8 text-center text-[11px] text-gray-400 border-t border-gray-100 pt-3">
          <p>مصنع مزايا للأثاث - نظام إداري مالي موحد • تم استخراج الكشف بتاريخ {todayStr}</p>
        </div>

        {/* Interactive Controls (Hidden during print) */}
        <div className="mt-8 pt-4 border-t flex items-center justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold rounded-xl shadow-lg transition-all"
          >
            <span>🖨️</span>
            <span>طباعة كشف الحساب / حفظ PDF</span>
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
