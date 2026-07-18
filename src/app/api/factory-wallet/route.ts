import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { INCOME_TYPES, EXPENSE_TYPES, PAYOUT_TYPES } from '@/lib/finance';

// ============================================================
// GET /api/factory-wallet
// ملخص محفظة المصنع التراكمي اليومي.
//   - يستثني القيود التمريرية (is_pass_through=true) تمامًا.
//   - يرجع: today (ملخص اليوم الحالي للكروت) + days (للجدول).
// ============================================================

interface DayBucket {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: any[];
}

function toNum(v: any): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('factory_wallet', 'view');
    void user; // admin/branch_user check done

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '7');
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';

    // نافذة العرض (للجدول). افتراضيًا آخر N يوم.
    const now = new Date();
    let windowFrom: Date;
    let windowTo: Date;
    if (date_from && date_to) {
      windowFrom = new Date(date_from);
      windowTo = new Date(date_to);
    } else {
      windowTo = now;
      windowFrom = new Date();
      windowFrom.setDate(windowFrom.getDate() - (daysParam - 1));
    }
    const windowFromStr = windowFrom.toISOString().slice(0, 10);
    const windowToStr = windowTo.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);

    // 1) الرصيد الافتتاحي = صافي كل القيود قبل windowFrom (تراكمي من أول النظام)
    //    يستثني التمريري.
    const openingRows: Array<{ net: number }> = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(
         CASE
           WHEN entry_type = ANY($1::text[]) AND is_pass_through = false THEN amount
           WHEN entry_type = ANY($2::text[]) AND is_pass_through = false THEN -amount
           WHEN entry_type = ANY($3::text[]) AND is_pass_through = false THEN -amount
           ELSE 0
         END
       ), 0)::float8 AS net
       FROM mazaya.journal_entries
       WHERE date < $4::date`,
      INCOME_TYPES as readonly string[],
      EXPENSE_TYPES as readonly string[],
      PAYOUT_TYPES as readonly string[],
      windowFromStr
    );
    let runningBalance = toNum(openingRows[0]?.net);

    // 2) كل القيود في النافذة (مرتبة تصاعديًا للحساب التراكمي) + بياناتها الكاملة
    const entries: any[] = await prisma.$queryRawUnsafe(
      `SELECT je.*,
          CASE
            WHEN je.party_type = 'supplier' THEN s.name
            WHEN je.party_type = 'branch' THEN b.name
            WHEN je.party_type = 'contractor' THEN c.name
            ELSE NULL
          END AS party_name
       FROM mazaya.journal_entries je
       LEFT JOIN mazaya.suppliers s ON je.party_type = 'supplier' AND je.party_id = s.id
       LEFT JOIN mazaya.branches b ON je.party_type = 'branch' AND je.party_id = b.id
       LEFT JOIN mazaya.contractors c ON je.party_type = 'contractor' AND je.party_id = c.id
       WHERE je.date >= $1::date AND je.date <= $2::date
       ORDER BY je.date ASC, je.created_at ASC`,
      windowFromStr, windowToStr
    );

    // 3) جمّع القيود حسب اليوم واحسب الأرصدة
    const byDay = new Map<string, any[]>();
    for (const e of entries) {
      const key = (e.date as Date).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }

    const dayBuckets: DayBucket[] = [];
    const sortedDates = Array.from(byDay.keys()).sort(); // تصاعدي

    for (const date of sortedDates) {
      const dayRows = byDay.get(date)!;
      const income = dayRows
        .filter(r => (INCOME_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const expense = dayRows
        .filter(r => (EXPENSE_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const payout = dayRows
        .filter(r => (PAYOUT_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const net = income - expense - payout;
      const opening = runningBalance;
      const closing = opening + net;
      runningBalance = closing;
      dayBuckets.push({
        date,
        opening: round2(opening),
        income: round2(income),
        expense: round2(expense + payout), // المصروف المعروض شامل المدفوعات للموردين
        payout: round2(payout),
        closing: round2(closing),
        count: dayRows.length,
        entries: dayRows.map(e => ({ ...e, amount: toNum(e.amount) })),
      });
    }

    // 4) ملخص اليوم الحالي (للكروت)
    let todayBucket: DayBucket;
    const inWindow = dayBuckets.find(d => d.date === todayKey);
    if (inWindow) {
      todayBucket = inWindow;
    } else if (todayKey > windowToStr) {
      // اليوم بعد النافذة: الرصيد الافتتاحي لليوم = آخر running balance
      todayBucket = {
        date: todayKey,
        opening: round2(runningBalance),
        income: 0, expense: 0, payout: 0,
        closing: round2(runningBalance),
        count: 0, entries: [],
      };
    } else {
      // اليوم قبل النافذة: نحسب الـ opening من القيود قبل اليوم
      const beforeToday: Array<{ net: number }> = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(
             CASE
               WHEN entry_type = ANY($1::text[]) AND is_pass_through = false THEN amount
               WHEN entry_type = ANY($2::text[]) AND is_pass_through = false THEN -amount
               WHEN entry_type = ANY($3::text[]) AND is_pass_through = false THEN -amount
               ELSE 0
             END
           ), 0)::float8 AS net
         FROM mazaya.journal_entries
         WHERE date < $4::date`,
        INCOME_TYPES as readonly string[],
        EXPENSE_TYPES as readonly string[],
        PAYOUT_TYPES as readonly string[],
        todayKey
      );
      const openingToday = toNum(beforeToday[0]?.net);
      todayBucket = {
        date: todayKey,
        opening: round2(openingToday),
        income: 0, expense: 0, payout: 0,
        closing: round2(openingToday),
        count: 0, entries: [],
      };
    }

    // 5) رتّب الأيام تنازليًا (الأحدث فوق) للجدول
    const daysDesc = [...dayBuckets].sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      ok: true,
      data: {
        today: todayBucket,
        days: daysDesc,
        current_balance: todayBucket.closing,
        window: { from: windowFromStr, to: windowToStr },
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
