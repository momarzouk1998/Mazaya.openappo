import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { BOARDS_EXPENSE_TYPES } from '@/lib/finance';

// ============================================================
// GET /api/boards-wallet — يومية الألواح
// ============================================================
// يومية الألواح = إجمالي الفلوس اللي اتصرفت على الألواح والإكسسوارات.
// كل حاجة مصروف (مفيش وارد):
//   - مشتريات عادية (المصنع دفع من جيبه)
//   - تمريري صادر لمورد (المعرض دفع للمورد مباشرة علشان ألواح)
//
// ملاحظة على التمريري في الداتابيز: بينشئ قيدين، بس بنحسب بس
// قيد "الصادر للمورد" (entry_type='دفعة صادرة لمورد' + is_pass_through=true)
// لأن ده اللي يمثل شراء ألواح. قيد "الوارد من المعرض" نتجاهله هنا.
//
// معادلة اليوم:
//   opening     = رصيد آخر يوم قبله (تراكمي)
//   purchases   = مشتريات عادية
//   passthrough = تمريري صادر للمورد
//   expense     = purchases + passthrough
//   closing     = opening - expense
// ============================================================

interface DayBucket {
  date: string;
  opening: number;
  purchases: number;
  passthrough: number;
  expense: number;
  closing: number;
  count: number;
  entries: any[];
}

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'object') {
    const obj = v as { toNumber?: () => number; toString?: () => string };
    if (typeof obj.toNumber === 'function') return obj.toNumber();
    if (typeof obj.toString === 'function') {
      const n = parseFloat(obj.toString());
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return isNaN(v) ? 0 : v;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ملخص الرصيد الافتتاحي: صافي (المشتريات + تمريري صادر) قبل تاريخ معيّن.
// كل القيود دي مصروف، فبنجمعها بالسالب.
async function getOpeningBalance(beforeDate: string): Promise<number> {
  const rows: Array<{ total_spent: number }> = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(
       CASE
         WHEN entry_type = ANY($1::text[]) THEN amount
         WHEN entry_type = 'دفعة صادرة لمورد' AND is_pass_through = true THEN amount
         ELSE 0
       END
     ), 0)::float8 AS total_spent
     FROM mazaya.journal_entries
     WHERE date < $2::date`,
    BOARDS_EXPENSE_TYPES as readonly string[],
    beforeDate
  );
  // total_spent موجب، لكن ده مصروف، فالرصيد = -spent
  return -toNum(rows[0]?.total_spent);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('boards_wallet', 'view');
    void user;

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '7');
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';

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

    // الرصيد الافتتاحي قبل النافذة
    const runningBalance = await getOpeningBalance(windowFromStr);
    let balance = runningBalance;

    // كل القيود المتعلقة بيومية الألواح في النافذة:
    // مشتريات عادية + تمريري صادر للمورد (بنستثني قيد الوارد من المعرض)
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
         AND (
           je.entry_type = ANY($3::text[])                              -- مشتريات عادية
           OR (je.entry_type = 'دفعة صادرة لمورد' AND je.is_pass_through = true)  -- تمريري صادر
         )
       ORDER BY je.date ASC, je.created_at ASC`,
      windowFromStr, windowToStr,
      BOARDS_EXPENSE_TYPES as readonly string[]
    );

    // تجميع حسب اليوم
    const byDay = new Map<string, any[]>();
    for (const e of entries) {
      const key = (e.date as Date).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }

    const dayBuckets: DayBucket[] = [];
    const sortedDates = Array.from(byDay.keys()).sort();

    for (const date of sortedDates) {
      const dayRows = byDay.get(date)!;
      // مشتريات عادية (بدون تمريري)
      const purchases = dayRows
        .filter(r => (BOARDS_EXPENSE_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce<number>((s, r) => s + toNum(r.amount), 0);
      // تمريري صادر للمورد
      const passthrough = dayRows
        .filter(r => r.entry_type === 'دفعة صادرة لمورد' && r.is_pass_through)
        .reduce<number>((s, r) => s + toNum(r.amount), 0);
      const expense = purchases + passthrough;
      const opening = balance;
      const closing = opening - expense;
      balance = closing;
      dayBuckets.push({
        date,
        opening: round2(opening),
        purchases: round2(purchases),
        passthrough: round2(passthrough),
        expense: round2(expense),
        closing: round2(closing),
        count: dayRows.length,
        entries: dayRows.map(e => ({ ...e, amount: toNum(e.amount) })),
      });
    }

    // ملخص اليوم الحالي
    let todayBucket: DayBucket;
    const inWindow = dayBuckets.find(d => d.date === todayKey);
    if (inWindow) {
      todayBucket = inWindow;
    } else if (todayKey > windowToStr) {
      todayBucket = {
        date: todayKey,
        opening: round2(balance),
        purchases: 0, passthrough: 0, expense: 0,
        closing: round2(balance),
        count: 0, entries: [],
      };
    } else {
      const openingToday = await getOpeningBalance(todayKey);
      todayBucket = {
        date: todayKey,
        opening: round2(openingToday),
        purchases: 0, passthrough: 0, expense: 0,
        closing: round2(openingToday),
        count: 0, entries: [],
      };
    }

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
