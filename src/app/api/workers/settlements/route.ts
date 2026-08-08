import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/workers/settlements
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'view');
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = (page - 1) * limit;

    const where: any = {};
    if (workerId) where.worker_id = workerId;
    if (startDate || endDate) {
      where.period_end = {};
      if (startDate) where.period_end.gte = new Date(startDate);
      if (endDate) where.period_end.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      (prisma as any).worker_weekly_settlements.findMany({
        where,
        orderBy: [{ period_end: 'desc' }, { settled_at: 'desc' }],
        include: { worker: { select: { id: true, name: true } } },
        skip: offset,
        take: limit,
      }),
      (prisma as any).worker_weekly_settlements.count({ where }),
    ]);

    const serialized = items.map((i: any) => ({
      ...i,
      total_wages: Number(i.total_wages),
      total_bonuses: Number(i.total_bonuses),
      total_discounts: Number(i.total_discounts),
      total_advances: Number(i.total_advances),
      net_payable: Number(i.net_payable),
    }));

    return NextResponse.json({
      ok: true,
      data: { items: serialized, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Settlements GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/workers/settlements
// Body: { period_start, period_end, worker_ids: string[] (or null for all workers), notes }
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'add');
    const body = await request.json();
    const { period_start, period_end, worker_ids, notes } = body;

    if (!period_start || !period_end) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'تاريخ بداية ونهاية الفترة مطلوبان' } },
        { status: 400 }
      );
    }

    const startDate = new Date(period_start);
    const endDate = new Date(period_end);

    // Get workers to settle
    const workerWhere: any = { deleted_at: null };
    if (Array.isArray(worker_ids) && worker_ids.length > 0) {
      workerWhere.id = { in: worker_ids };
    }
    const targetWorkers = await prisma.workers.findMany({ where: workerWhere, select: { id: true, name: true } });

    if (targetWorkers.length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'لم يتم العثور على عمال للتقفيل' } }, { status: 404 });
    }

    const createdSettlements = await prisma.$transaction(async (tx) => {
      const settled = [];

      for (const w of targetWorkers) {
        // 1) Fetch daily logs in period
        const dailyLogs = await (tx as any).worker_daily_logs.findMany({
          where: {
            worker_id: w.id,
            work_date: { gte: startDate, lte: endDate },
          },
        });
        const totalWages = dailyLogs.reduce((sum: number, l: any) => sum + Number(l.daily_rate), 0);
        const totalDays = dailyLogs.length;

        // 2) Fetch bonuses/discounts in period
        const adjustments = await (tx as any).worker_bonuses.findMany({
          where: {
            worker_id: w.id,
            bonus_date: { gte: startDate, lte: endDate },
          },
        });
        const totalBonuses = adjustments.filter((a: any) => a.bonus_type === 'مكافأة').reduce((s: number, a: any) => s + Number(a.amount), 0);
        const totalDiscounts = adjustments.filter((a: any) => a.bonus_type === 'خصم').reduce((s: number, a: any) => s + Number(a.amount), 0);

        // 3) Fetch advances (سلف) in period from overhead_expenses
        const advances = await tx.overhead_expenses.findMany({
          where: {
            worker_id: w.id,
            payment_kind: 'سلفة',
            date: { gte: startDate, lte: endDate },
          },
        });
        const totalAdvances = advances.reduce((s: number, a: any) => s + Number(a.amount), 0);

        const netPayable = totalWages + totalBonuses - totalDiscounts - totalAdvances;

        // Create settlement record
        const settlement = await (tx as any).worker_weekly_settlements.create({
          data: {
            worker_id: w.id,
            period_start: startDate,
            period_end: endDate,
            total_days: totalDays,
            total_wages: totalWages,
            total_bonuses: totalBonuses,
            total_discounts: totalDiscounts,
            total_advances: totalAdvances,
            net_payable: netPayable,
            notes: notes || `تقفيل أسبوعي للعامل ${w.name}`,
            created_by: user.id,
          },
        });

        // Create overhead expense & journal entry for net paid if netPayable > 0
        if (netPayable > 0) {
          const journalEntry = await tx.journal_entries.create({
            data: {
              date: endDate,
              entry_type: 'أجور عمال',
              description: `صافي أجر تقفيل أسبوعي: ${w.name}`,
              amount: netPayable,
              payment_method: 'نقدي',
              created_by: user.id,
            },
          });
          await tx.overhead_expenses.create({
            data: {
              date: endDate,
              category: 'أجور عمال',
              description: `صافي أجر تقفيل أسبوعي: ${w.name}`,
              amount: netPayable,
              payment_method: 'نقدي',
              payment_kind: 'قبض',
              worker_id: w.id,
              journal_entry_id: journalEntry.id,
              created_by: user.id,
              notes: `تقفيل أسبوعي من ${period_start} إلى ${period_end}`,
            },
          });
        }

        settled.push({
          ...settlement,
          total_wages: Number(settlement.total_wages),
          total_bonuses: Number(settlement.total_bonuses),
          total_discounts: Number(settlement.total_discounts),
          total_advances: Number(settlement.total_advances),
          net_payable: Number(settlement.net_payable),
        });
      }
      return settled;
    });

    auditLog({
      user_id: user.id,
      action: 'create',
      table_name: 'worker_weekly_settlements',
      row_id: createdSettlements[0]?.id || 'batch',
      after: { period_start, period_end, count: createdSettlements.length } as any,
    });

    return NextResponse.json({ ok: true, data: { count: createdSettlements.length, items: createdSettlements } }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Settlements POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
