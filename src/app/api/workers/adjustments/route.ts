import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/workers/adjustments
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
      where.bonus_date = {};
      if (startDate) where.bonus_date.gte = new Date(startDate);
      if (endDate) where.bonus_date.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.worker_bonuses.findMany({
        where,
        orderBy: [{ bonus_date: 'desc' }, { created_at: 'desc' }],
        include: { worker: { select: { id: true, name: true } } },
        skip: offset,
        take: limit,
      }),
      prisma.worker_bonuses.count({ where }),
    ]);

    const serialized = items.map((i: any) => ({
      ...i,
      amount: Number(i.amount),
    }));

    return NextResponse.json({
      ok: true,
      data: { items: serialized, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Adjustments GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/workers/adjustments
// Body: { worker_id, bonus_type: "مكافأة" | "خصم", amount, reason, bonus_date, notes }
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'add');
    const body = await request.json();
    const { worker_id, bonus_type, amount, reason, bonus_date, notes } = body;

    if (!worker_id || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'العامل والمبلغ مطلوبان' } },
        { status: 400 }
      );
    }

    const type = bonus_type === 'خصم' ? 'خصم' : 'مكافأة';
    const date = bonus_date ? new Date(bonus_date) : new Date();

    const item = await prisma.worker_bonuses.create({
      data: {
        worker_id,
        bonus_type: type,
        amount: Number(amount),
        reason: reason || type,
        bonus_date: date,
        notes: notes || null,
        created_by: user.id,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'worker_bonuses', row_id: item.id, after: item as any });

    return NextResponse.json({ ok: true, data: { ...item, amount: Number(item.amount) } }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Adjustments POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// DELETE /api/workers/adjustments?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission('workers', 'delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'المعرف مطلوب' } }, { status: 400 });
    }

    await prisma.worker_bonuses.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
