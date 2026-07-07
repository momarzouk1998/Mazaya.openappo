import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/orders/:id/extra-costs
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;

    const items = await prisma.order_extra_costs.findMany({
      where: { order_id: id },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      data: items.map((r) => ({ ...r, amount: Number(r.amount) })),
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Extra costs list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/orders/:id/extra-costs  — body can be a single object or array
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];

    if (!items.length) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات' } }, { status: 400 });
    }

    const created = await prisma.order_extra_costs.createMany({
      data: items.map((it: any) => ({
        order_id: id,
        cost_type: it.cost_type || 'أخرى',
        amount: Number(it.amount) || 0,
        notes: it.notes || null,
      })),
    });

    for (const it of items) {
      auditLog({ user_id: user.id, action: 'create', table_name: 'order_extra_costs', row_id: id, after: it });
    }

    return NextResponse.json({ ok: true, data: { count: created.count } }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Extra costs create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// DELETE /api/orders/:id/extra-costs?extra_id=all | ?extra_id=uuid
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const extraId = searchParams.get('extra_id');

    if (extraId === 'all') {
      const { count } = await prisma.order_extra_costs.deleteMany({ where: { order_id: id } });
      auditLog({ user_id: user.id, action: 'delete', table_name: 'order_extra_costs', row_id: id });
      return NextResponse.json({ ok: true, data: { deleted: count } });
    }

    if (!extraId) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'extra_id مطلوب' } }, { status: 400 });
    }

    await prisma.order_extra_costs.delete({ where: { id: extraId, order_id: id } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'order_extra_costs', row_id: extraId });
    return NextResponse.json({ ok: true, data: { deleted: 1 } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Extra costs delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
