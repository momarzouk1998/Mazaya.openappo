"use client";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import {
  formatCurrency,
  formatDate,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import { downloadElementAsPdf } from "@/lib/pdf-export";
import { canSeeModule } from "@/lib/auth";

interface DayEntry {
  id: string;
  date: string | Date;
  entry_type: string;
  description: string;
  amount: number;
  payment_method: string | null;
  party_name: string | null;
  party_type: string | null;
  order_id: string | null;
  order_name?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: DayEntry[];
}

interface WalletResponse {
  today: DayData;
  days: DayData[];
  current_balance: number;
  totals: any;
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function cleanDescription(desc: any): string {
  if (!desc) return "";
  return String(desc)
    .replace(/\s*\(كود:\s*ACC-[^)]+\)/gi, "")
    .replace(/\s*\(كود:\s*BRD-[^)]+\)/gi, "")
    .replace(/\s*\(كود:[^)]*\)/gi, "")
    .replace(/\s*\(كود\s*[^)]*\)/gi, "")
    .trim();
}

export default function DayReportPage() {
  const params = useParams<{ date?: string }>();
  const dateStr = params?.date || new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const { user: profile } = useUserStore();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [search, setSearch] = useState("");

  const query = `/api/factory-wallet?date_from=${dateStr}&date_to=${dateStr}`;
  const { data, loading } = useApi<WalletResponse>(query);

  // All useMemos and hooks BEFORE any conditional returns to avoid React error #310
  const dayData: DayData = useMemo(() => {
    if (!data) {
      return {
        date: dateStr,
        opening: 0,
        income: 0,
        expense: 0,
        payout: 0,
        closing: 0,
        count: 0,
        entries: [],
      };
    }
    return (
      data.days?.find((d) => d.date === dateStr) ||
      data.days?.[0] ||
      data.today || {
        date: dateStr,
        opening: 0,
        income: 0,
        expense: 0,
        payout: 0,
        closing: 0,
        count: 0,
        entries: [],
      }
    );
  }, [data, dateStr]);

  const dateObj = useMemo(() => new Date(dateStr + "T00:00:00"), [dateStr]);
  const dayName = useMemo(() => {
    return isNaN(dateObj.getTime()) ? "" : DAY_NAMES[dateObj.getDay()];
  }, [dateObj]);

  const filteredEntries = useMemo(() => {
    let list = dayData.entries || [];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((e) => {
        const cleanDesc = cleanDescription(e.description).toLowerCase();
        return (
          cleanDesc.includes(q) ||
          (e.party_name || "").toLowerCase().includes(q) ||
          (e.entry_type || "").toLowerCase().includes(q) ||
          String(e.amount || "").includes(q)
        );
      });
    }
    return list;
  }, [dayData.entries, search]);

  function handleExportExcel() {
    const clean = filteredEntries.map((e, idx) => ({
      "#": idx + 1,
      التاريخ: dateStr,
      "نوع الحركة": ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type,
      البيان: cleanDescription(e.description),
      "الجهة / الطرف": e.party_name || "—",
      "طريقة الدفع": PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي",
      الوارد: e.entry_type === "دفعة واردة من معرض" ? fmtNum(e.amount) : 0,
      المصروف: e.entry_type !== "دفعة واردة من معرض" ? fmtNum(e.amount) : 0,
      الملاحظات: e.notes || "—",
    }));

    exportToExcel(clean, `تقرير_يومية_المصنع_${dateStr}`);
  }

  async function handleDownloadPdf() {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      await downloadElementAsPdf({
        elementId: "printable-day-report",
        fileName: `تقرير_يومية_المصنع_${dateStr}`,
        orientation: "landscape",
      });
    } catch (e) {
      console.error("PDF download error:", e);
      alert("تعذر إنشاء ملف PDF، يرجى المحاولة مرة أخرى.");
    } finally {
      setPdfGenerating(false);
    }
  }

  // Early returns after hooks
  if (!profile) return null;
  const canSee = canSeeModule(profile, "factory_wallet");

  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة مع العنوان المحدث والأزرار */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <span>📋</span>
            <span>تقرير اليوم — {dayName} {formatDate(dateStr)}</span>
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          >
            <span>📥</span>
            <span>تحميل Excel</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
          >
            <span>🖨️</span>
            <span>طباعة</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 disabled:opacity-50"
          >
            <span>{pdfGenerating ? "⏳" : "📄"}</span>
            <span>{pdfGenerating ? "جاري التجهيز..." : "تحميل PDF"}</span>
          </Button>

          <Link
            href="/factory-wallet"
            className="btn-secondary h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
          >
            <span>←</span>
            <span>رجوع لليومية</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* جدول مالي أنيق ومدمج ومباشر بالأرقام الأساسية الأربعة */}
      {/* ======================================================== */}
      <div className="card overflow-hidden p-0 border border-gray-200 shadow-xs rounded-xl bg-white mb-3">
        <table className="w-full text-center text-xs">
          <thead className="bg-gray-100/90 text-gray-700 border-b border-gray-200 font-bold">
            <tr>
              <th className="p-2.5 text-center">🪙 الرصيد الافتتاحي</th>
              <th className="p-2.5 text-center text-emerald-800">📥 إجمالي الوارد</th>
              <th className="p-2.5 text-center text-rose-800">📤 إجمالي المصروف</th>
              <th className="p-2.5 text-center text-brand-orange-dark">💵 الرصيد الختامي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`p-3 text-base font-extrabold font-mono ${dayData.opening < 0 ? "text-rose-600" : "text-gray-900"}`}>
                {formatCurrency(dayData.opening)}
              </td>
              <td className="p-3 text-base font-extrabold font-mono text-emerald-700 bg-emerald-50/40">
                +{formatCurrency(dayData.income)}
              </td>
              <td className="p-3 text-base font-extrabold font-mono text-rose-700 bg-rose-50/40">
                -{formatCurrency(dayData.expense)}
              </td>
              <td className="p-3 text-base font-extrabold font-mono text-brand-orange-dark bg-orange-50/40">
                {formatCurrency(dayData.closing)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ======================================================== */}
      {/* شريط البحث السريع */}
      {/* ======================================================== */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-700">
          حركات اليوم المسجلة ({filteredEntries.length})
        </span>

        <div className="relative w-56 sm:w-72">
          <input
            type="text"
            placeholder="🔍 بحث في البيان أو الطرف أو المبلغ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* جدول الحركات التفصيلي بدون عمود الأثر */}
      {/* ======================================================== */}
      {loading ? (
        <div className="card text-center py-12 bg-white border">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات اليومية...</div>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-2.5 py-2 text-center font-bold text-gray-500 w-8">#</th>
                  <th className="px-2.5 py-2 text-center font-extrabold whitespace-nowrap">نوع الحركة</th>
                  <th className="px-3 py-2 text-start font-extrabold">البيان والوصف</th>
                  <th className="px-2.5 py-2 text-center font-extrabold whitespace-nowrap">الجهة / الطرف</th>
                  <th className="px-2.5 py-2 text-center font-extrabold whitespace-nowrap">طريقة الدفع</th>
                  <th className="px-2.5 py-2 text-center font-extrabold whitespace-nowrap text-emerald-800">الوارد (+)</th>
                  <th className="px-2.5 py-2 text-center font-extrabold whitespace-nowrap text-rose-800">المصروف (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((e, i) => {
                  const isIncome = e.entry_type === "دفعة واردة من معرض";
                  const amt = fmtNum(e.amount);
                  return (
                    <tr key={e.id || i} className="hover:bg-orange-50/30 transition">
                      <td className="px-2.5 py-2 text-center text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${ENTRY_TYPE_COLORS[e.entry_type] || "bg-gray-100 text-gray-800"}`}>
                          {ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        {cleanDescription(e.description)}
                        {e.order_id && (
                          <Link
                            href={`/orders/${e.order_id}`}
                            className="mr-1 inline-block text-[10px] font-bold text-brand-orange hover:underline bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200"
                          >
                            📦 أوردر مرتبط
                          </Link>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center text-gray-600 font-medium whitespace-nowrap">
                        {e.party_name || "—"}
                      </td>
                      <td className="px-2.5 py-2 text-center text-gray-600 whitespace-nowrap">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                          {PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-center font-extrabold font-mono text-emerald-700 whitespace-nowrap">
                        {isIncome ? formatCurrency(amt) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-center font-extrabold font-mono text-rose-700 whitespace-nowrap">
                        {!isIncome ? formatCurrency(amt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-extrabold text-xs text-gray-800">
                <tr>
                  <td className="px-2.5 py-2 text-center text-gray-500">Σ</td>
                  <td colSpan={4} className="px-3 py-2 text-start">
                    إجمالي حركات اليوم ({filteredEntries.length} حركة)
                  </td>
                  <td className="px-2.5 py-2 text-center font-mono font-bold text-emerald-800 whitespace-nowrap">
                    +{formatCurrency(filteredEntries.filter((e) => e.entry_type === "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0))}
                  </td>
                  <td className="px-2.5 py-2 text-center font-mono font-bold text-rose-800 whitespace-nowrap">
                    -{formatCurrency(filteredEntries.filter((e) => e.entry_type !== "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-12 bg-white border rounded-xl">
          <div className="text-4xl mb-2">📭</div>
          <div className="font-bold text-gray-700 text-sm">لا توجد حركات مسجلة في هذا اليوم</div>
          <div className="text-xs text-gray-400 mt-0.5">لم تسجل أي حركة نقدية في هذا التاريخ.</div>
        </div>
      )}

      {/* ======================================================== */}
      {/* حاوية الطباعة وتحميل الـ PDF المستقلة عالية الجودة (Off-screen) */}
      {/* ======================================================== */}
      <div
        id="printable-day-report"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "1200px",
          backgroundColor: "#ffffff",
          padding: "24px",
          color: "#111827",
          fontFamily: "Tajawal, sans-serif",
          zIndex: -100,
        }}
      >
        {/* ترويسة المستند */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #ea580c", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#111827", margin: 0 }}>شركة مزايا للتصنيع والأثاث</h1>
            <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#ea580c", marginTop: "4px", margin: 0 }}>
              تقرير اليوم — {dayName} {formatDate(dateStr)}
            </h2>
          </div>
          <div style={{ textAlign: "left", fontSize: "11px", color: "#4b5563" }}>
            <div>تاريخ الاستخراج: {new Date().toLocaleDateString("ar-EG")}</div>
            <div>إجمالي الحركات: {dayData.entries.length} حركة</div>
          </div>
        </div>

        {/* جدول الإحصائيات الأربعة في الـ PDF */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "center", marginBottom: "16px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "8px", border: "1px solid #e5e7eb" }}>🪙 الرصيد الافتتاحي</th>
              <th style={{ padding: "8px", border: "1px solid #e5e7eb", color: "#166534" }}>📥 إجمالي الوارد</th>
              <th style={{ padding: "8px", border: "1px solid #e5e7eb", color: "#9f1239" }}>📤 إجمالي المصروف</th>
              <th style={{ padding: "8px", border: "1px solid #e5e7eb", color: "#ea580c" }}>💵 الرصيد الختامي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #e5e7eb", fontWeight: "900", fontFamily: "monospace", fontSize: "14px" }}>{formatCurrency(dayData.opening)}</td>
              <td style={{ padding: "8px", border: "1px solid #e5e7eb", fontWeight: "900", fontFamily: "monospace", fontSize: "14px", color: "#15803d", backgroundColor: "#f0fdf4" }}>+{formatCurrency(dayData.income)}</td>
              <td style={{ padding: "8px", border: "1px solid #e5e7eb", fontWeight: "900", fontFamily: "monospace", fontSize: "14px", color: "#be123c", backgroundColor: "#fff1f2" }}>-{formatCurrency(dayData.expense)}</td>
              <td style={{ padding: "8px", border: "1px solid #e5e7eb", fontWeight: "900", fontFamily: "monospace", fontSize: "14px", color: "#ea580c", backgroundColor: "#fff7ed" }}>{formatCurrency(dayData.closing)}</td>
            </tr>
          </tbody>
        </table>

        {/* جدول حركات اليوم في الـ PDF */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", textAlign: "center" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", width: "24px" }}>#</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>نوع الحركة</th>
              <th style={{ padding: "6px 6px", border: "1px solid #e5e7eb", fontWeight: "800", textAlign: "right" }}>البيان والوصف</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>الجهة / الطرف</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>طريقة الدفع</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>الوارد (+)</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>المصروف (-)</th>
            </tr>
          </thead>
          <tbody>
            {dayData.entries.map((e, i) => {
              const isIncome = e.entry_type === "دفعة واردة من معرض";
              const amt = fmtNum(e.amount);
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                  <td style={{ padding: "5px 3px", border: "1px solid #e5e7eb", color: "#6b7280", fontFamily: "monospace" }}>{i + 1}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", whiteSpace: "nowrap", fontWeight: "700" }}>{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</td>
                  <td style={{ padding: "5px 6px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: "600" }}>{cleanDescription(e.description)}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#4b5563" }}>{e.party_name || "—"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb" }}>{PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#15803d", fontWeight: "800", fontFamily: "monospace" }}>{isIncome ? formatCurrency(amt) : "—"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#be123c", fontWeight: "800", fontFamily: "monospace" }}>{!isIncome ? formatCurrency(amt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#fef3c7", borderTop: "2px solid #d97706", fontWeight: "900", fontSize: "11px" }}>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a" }}>Σ</td>
              <td colSpan={4} style={{ padding: "6px 6px", border: "1px solid #fde68a", textAlign: "right" }}>إجمالي حركة اليوم ({dayData.entries.length} حركة)</td>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a", fontFamily: "monospace", color: "#15803d" }}>+{formatCurrency(dayData.income)}</td>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a", fontFamily: "monospace", color: "#be123c" }}>-{formatCurrency(dayData.expense)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* تنسيقات الطباعة */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          header, aside, .btn-secondary, button, input, select, .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            break-inside: avoid;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
