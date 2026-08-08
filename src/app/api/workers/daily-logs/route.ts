import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/workers/daily-logs
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'view');
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const workerId = searchParams.get('worker_id');
    const orderId = searchParams.get('order_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = (page - 1) * limit;

    const where: any = {};
    if (date) {
      const d = new Date(date);
      where.work_date = d;
    } else if (startDate || endDate) {
      where.work_date = {};
      if (startDate) where.work_date.gte = new Date(startDate);
      if (endDate) where.work_date.lte = new Date(endDate);
    }
    if (workerId) where.worker_id = workerId;
    if (orderId) where.order_id = orderId;

    const [items, total] = await Promise.all([
      prisma.worker_daily_logs.findMany({
        where,
        orderBy: [{ work_date: 'desc' }, { created_at: 'desc' }],
        include: {
          worker: { select: { id: true, name: true, daily_rate: true, travel_daily_rate: true } },
          order: { select: { id: true, order_name: true, customer: { select: { name: true } } } },
        },
        skip: offset,
        take: limit,
      }),
      prisma.worker_daily_logs.count({ where }),
    ]);

    const serialized = items.map((i: any) => ({
      ...i,
      daily_rate: Number(i.daily_rate),
    }));

    return NextResponse.json({
      ok: true,
      data: { items: serialized, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Daily logs GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/workers/daily-logs
// Body: { date: "YYYY-MM-DD", entries: [ { worker_id, order_id, daily_rate, is_travel, notes } ] }
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'add');
    const body = await request.json();
    const { date, entries } = body;

    if (!date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'التاريخ وقائمة اليوميات مطلوبان' } },
        { status: 400 }
      );
    }

    const workDate = new Date(date);

    const results = await prisma.$transaction(async (tx) => {
      const saved = [];
      for (const entry of entries) {
        if (!entry.worker_id) continue;
        const rate = Number(entry.daily_rate ?? 0);
        const orderId = entry.order_id || null;
        const isTravel = Boolean(entry.is_travel);
        const notes = entry.notes || null;

        // Check if log exists for this worker on this date
        const existing = await tx.worker_daily_logs.findFirst({
          where: { worker_id: entry.worker_id, work_date: workDate },
        });

        let logRecord;
        if (existing) {
          logRecord = await tx.worker_daily_logs.update({
            where: { id: existing.id },
            data: {
              order_id: orderId,
              daily_rate: rate,
              is_travel: isTravel,
              notes,
              updated_at: new Date(),
            },
          });
        } else {
          logRecord = await tx.worker_daily_logs.create({
            data: {
              worker_id: entry.worker_id,
              order_id: orderId,
              work_date: workDate,
              daily_rate: rate,
              is_travel: isTravel,
              notes,
              created_by: user.id,
            },
          });
        }
        saved.push({ ...logRecord, daily_rate: Number(logRecord.daily_rate) });
      }
      return saved;
    });

    auditLog({
      user_id: user.id,
      action: 'create',
      table_name: 'worker_daily_logs',
      row_id: results[0]?.id || 'batch',
      after: { date, count: results.length } as any,
    });

    return NextResponse.json({ ok: true, data: { date, count: results.length, items: results } }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Daily logs POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// DELETE /api/workers/daily-logs?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'معرف اليومية مطلوب' } }, { status: 400 });
    }

    await prisma.worker_daily_logs.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: { message: 'تم حذف اليومية' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
