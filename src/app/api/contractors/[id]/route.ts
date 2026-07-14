import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('contractors', 'view');
    const { id } = await params;
    const item = await prisma.contractors.findFirst({ where: { id, deleted_at: null } });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المقاول غير موجود' } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('contractors', 'edit');
    const { id } = await params;
    const intId = id;
    const before = await prisma.contractors.findFirst({ where: { id: intId, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: '\u0627\u0644\u0645\u0642\u0627\u0648\u0644 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['name', 'type', 'phone', 'notes'];
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

    const item = await prisma.contractors.update({ where: { id: intId }, data });
    auditLog({ user_id: user.id, action: 'update', table_name: 'contractors', row_id: intId, before: before as any, after: item as any });

    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Contractor update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('contractors', 'delete');
    const { id } = await params;
    const intId = id;
    const before = await prisma.contractors.findFirst({ where: { id: intId, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: '\u0627\u0644\u0645\u0642\u0627\u0648\u0644 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f' } }, { status: 404 });
    }

    // Check for external work referencing this contractor
    const ref = await prisma.order_external_work.findFirst({ where: { contractor_id: intId }, select: { id: true } });
    if (ref) {
      return NextResponse.json(
        { ok: false, error: { code: 'REFERENCE_ERROR', message: 'لا يمكن حذف هذا المقاول لوجود أعمال خارجية مرتبطة به' } },
        { status: 409 }
      );
    }

    await prisma.contractors.update({ where: { id: intId }, data: { deleted_at: new Date() } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'contractors', row_id: intId, before: before as any });

    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Contractor delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
