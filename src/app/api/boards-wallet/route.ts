import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { BOARDS_EXPENSE_TYPES } from '@/lib/finance';

// ============================================================
// GET /api/boards-wallet — يومية الألواح
// ============================================================
// يومية الألواح بتتبع الألواح فقط:
//   - الوارد = التمريري الصادر للمورد (أي تحويل تمريري = شراء ألواح،
//     المعرض دفعت للمورد علشان يشتري ألواح للمصنع، فبتدخل المخزن).
//   - المصروف = شراء الألواح (entry_type='مشتريات' من /api/boards/purchase).
//
// الإكسسوارات مش هنا (لها entry_type='شراء إكسسوارات' بتدخل في يومية المصنع).
//
// التمريري في الداتابيز بيتسجل كقيدين:
//   1) 'دفعة واردة من معرض' + is_pass_through=true  (نتجاهله هنا)
//   2) 'دفعة صادرة لمورد' + is_pass_through=true   (بنحسبه كوارد في يومية الألواح)
// القاعدة الذهبية: أي تحويل تمريري → يظهر فورًا في الوارد بقيمته.
//
// معادلة اليوم:
//   opening = رصيد آخر يوم قبله (تراكمي)
//   income  = تمريري صادر للمورد
//   expense = مشتريات الألواح
//   closing = opening + income - expense
// ============================================================

interface DayBucket {
  date: string;
  opening: number;
  income: number;
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

// الرصيد الافتتاحي = (تمريري صادر - مشتريات) قبل تاريخ معيّن.
async function getOpeningBalance(beforeDate: string): Promise<number> {
  const rows: Array<{ net: number }> = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(
       CASE
         WHEN entry_type = 'دفعة صادرة لمورد' AND is_pass_through = true THEN amount
         WHEN entry_type = ANY($1::text[]) THEN -amount
         ELSE 0
       END
     ), 0)::float8 AS net
     FROM mazaya.journal_entries
     WHERE date < $2::date`,
    BOARDS_EXPENSE_TYPES as readonly string[],
    beforeDate
  );
  return toNum(rows[0]?.net);
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

    let balance = await getOpeningBalance(windowFromStr);

    // كل القيود المتعلقة بيومية الألواح في النافذة:
    //  - مشتريات الألواح (entry_type='مشتريات')
    //  - تمريري صادر لمورد (entry_type='دفعة صادرة لمورد' + is_pass_through=true) → وارد
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
           je.entry_type = ANY($3::text[])                              -- مشتريات ألواح
           OR (je.entry_type = 'دفعة صادرة لمورد' AND je.is_pass_through = true)  -- تمريري صادر = وارد
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
      // وارد = تمريري صادر للمورد
      const income = dayRows
        .filter(r => r.entry_type === 'دفعة صادرة لمورد' && r.is_pass_through)
        .reduce<number>((s, r) => s + toNum(r.amount), 0);
      // مصروف = مشتريات ألواح عادية
      const expense = dayRows
        .filter(r => (BOARDS_EXPENSE_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce<number>((s, r) => s + toNum(r.amount), 0);
      const net = income - expense;
      const opening = balance;
      const closing = opening + net;
      balance = closing;
      dayBuckets.push({
        date,
        opening: round2(opening),
        income: round2(income),
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
        income: 0, expense: 0,
        closing: round2(balance),
        count: 0, entries: [],
      };
    } else {
      const openingToday = await getOpeningBalance(todayKey);
      todayBucket = {
        date: todayKey,
        opening: round2(openingToday),
        income: 0, expense: 0,
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
