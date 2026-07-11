import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';

// ============================================================
// Single Source of Truth (SSoT) — ملخص اليومية
// ============================================================
// الإصلاح الرئيسي في F8 من الـ audit: الـ endpoint كان يستخدم
// مفاتيح إنجليزية ('purchase', 'incoming_from_branch', ...) في
// حين الـ app دايماً بيكتب المفاتيح العربية ('مشتريات', 'دفعة واردة من معرض', ...).
// النتيجة: total_in و total_out بيرجعوا 0 دايماً في الإنتاج.
//
// الآن بنستخدم نفس الـ 3 منطق من v_journal_kpis:
//   - total_in:    وارد من المعارض (entry_type='دفعة واردة من معرض' + not pass_through)
//   - total_out:   مصروف يومي (entry_type IN ('مشتريات', 'نثريات'))
//   - total_payout: دفعات للموردين (entry_type='دفعة صادرة لمورد' + not pass_through)
//   - net:         total_in - total_out - total_payout
// ============================================================

// نفس القيم اللي الـ _journal-page-wrapper.tsx بيستخدمها
// واللي الـ POST في /api/journal/route.ts بيتحقق منها
const INCOME_TYPES = ['دفعة واردة من معرض'];
const EXPENSE_TYPES = ['مشتريات', 'نثريات'];
const PAYOUT_TYPES = ['دفعة صادرة لمورد'];

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';

    // Build date filter (parameterized)
    const conditions: string[] = [];
    const rawParams: any[] = [];
    let paramIdx = 1;
    if (date_from) {
      conditions.push(`date >= $${paramIdx++}::date`);
      rawParams.push(date_from);
    }
    if (date_to) {
      conditions.push(`date <= $${paramIdx++}::date`);
      rawParams.push(date_to);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get per-entry-type breakdown (in Arabic keys, matching what the app writes)
    const byType: Array<{ entry_type: string; total_amount: number; count: number }> = await prisma.$queryRawUnsafe(
      `SELECT entry_type,
              COALESCE(SUM(amount), 0)::float8 as total_amount,
              COUNT(*)::int as count
       FROM mazaya.journal_entries
       ${whereClause}
       GROUP BY entry_type
       ORDER BY total_amount DESC`,
      ...rawParams
    );

    // KPIs (in Arabic keys now — F8 fix)
    const kpiRows: Array<{
      total_in: number;
      total_out: number;
      total_payout: number;
      net: number;
      pass_through: number;
    }> = await prisma.$queryRawUnsafe(
      `SELECT
         COALESCE(SUM(CASE
           WHEN entry_type = ANY($${paramIdx}::text[]) AND is_pass_through = false
           THEN amount ELSE 0 END), 0)::float8 as total_in,
         COALESCE(SUM(CASE
           WHEN entry_type = ANY($${paramIdx + 1}::text[])
           THEN amount ELSE 0 END), 0)::float8 as total_out,
         COALESCE(SUM(CASE
           WHEN entry_type = ANY($${paramIdx + 2}::text[]) AND is_pass_through = false
           THEN amount ELSE 0 END), 0)::float8 as total_payout,
         COALESCE(SUM(CASE
           WHEN entry_type = ANY($${paramIdx}::text[]) AND is_pass_through = false THEN amount
           WHEN entry_type = ANY($${paramIdx + 1}::text[]) THEN -amount
           WHEN entry_type = ANY($${paramIdx + 2}::text[]) AND is_pass_through = false THEN -amount
           ELSE 0 END), 0)::float8 as net,
         COALESCE(SUM(CASE WHEN is_pass_through = true THEN amount ELSE 0 END), 0)::float8 as pass_through
       FROM mazaya.journal_entries
       ${whereClause}`,
      ...rawParams, INCOME_TYPES, EXPENSE_TYPES, PAYOUT_TYPES
    );

    const kpi = kpiRows[0] || { total_in: 0, total_out: 0, total_payout: 0, net: 0, pass_through: 0 };

    return NextResponse.json({
      ok: true,
      data: {
        by_type: byType,
        total_in: kpi.total_in,        // وارد من المعارض
        total_out: kpi.total_out,      // مصروف (مشتريات + نثريات)
        total_payout: kpi.total_payout,// دفعات للموردين
        net: kpi.net,                  // الإجمالي الصافي
        pass_through: kpi.pass_through,// الحركات التمريرية (لا تحتسب)
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
