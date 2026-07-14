import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('branches', 'view');
    const { id } = await params;
    const item = await prisma.branches.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المعرض غير موجود' } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('branches', 'edit');
    const { id } = await params;
    const branchId = id;
    const before = await prisma.branches.findUnique({ where: { id: branchId } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المعرض غير موجود' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['name', 'location', 'phone', 'notes'];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات للتعديل' } }, { status: 400 });
    }
    data.updated_at = new Date();

    const item = await prisma.branches.update({ where: { id: branchId }, data });
    auditLog({ user_id: user.id, action: 'update', table_name: 'branches', row_id: branchId, before, after: item });

    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Branch update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('branches', 'delete');
    const { id } = await params;
    const branchId = id;

    const [userCount, orderCount, customerCount] = await Promise.all([
      prisma.users.count({ where: { branch_id: branchId } }),
      prisma.orders.count({ where: { branch_id: branchId } }),
      prisma.customers.count({ where: { branch_id: branchId } }),
    ]);

    if (userCount + orderCount + customerCount > 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'REFERENCE_ERROR', message: 'لا يمكن حذف هذا المعرض لوجود بيانات مرتبطة به (مستخدمين، أوردرات، أو عملاء)' } },
        { status: 409 }
      );
    }

    const before = await prisma.branches.findUnique({ where: { id: branchId } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المعرض غير موجود' } }, { status: 404 });
    }

    await prisma.branches.delete({ where: { id: branchId } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'branches', row_id: branchId, before });

    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Branch delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
