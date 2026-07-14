import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('workers', 'view');
    const { id } = await params;
    const item = await prisma.workers.findFirst({ where: { id, deleted_at: null } });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'العامل غير موجود' } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('workers', 'edit');
    const { id } = await params;
    const before = await prisma.workers.findFirst({ where: { id, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'العامل غير موجود' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['name', 'phone', 'notes'];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات للتعديل' } }, { status: 400 });
    }
    data.updated_at = new Date();

    const item = await prisma.workers.update({ where: { id }, data });
    auditLog({ user_id: user.id, action: 'update', table_name: 'workers', row_id: id, before: before as any, after: item as any });

    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Worker update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('workers', 'delete');
    const { id } = await params;
    const before = await prisma.workers.findFirst({ where: { id, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'العامل غير موجود' } }, { status: 404 });
    }

    // Check for expenses referencing this worker
    const ref = await prisma.overhead_expenses.findFirst({ where: { worker_id: id }, select: { id: true } });
    if (ref) {
      return NextResponse.json(
        { ok: false, error: { code: 'REFERENCE_ERROR', message: 'لا يمكن حذف هذا العامل لوجود مصروفات مرتبطة به' } },
        { status: 409 }
      );
    }

    await prisma.workers.update({ where: { id }, data: { deleted_at: new Date() } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'workers', row_id: id, before: before as any });

    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Worker delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
