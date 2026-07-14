import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('boards_inventory', 'view');
    const { id } = await params;
    const item = await prisma.boards_inventory.findFirst({
      where: { id, deleted_at: null },
      include: { supplier: true },
    });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الصنف غير موجود' } }, { status: 404 });
    }
    const { supplier, ...rest } = item;
    return NextResponse.json({ ok: true, data: { ...rest, supplier_name: supplier?.name || null } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('boards_inventory', 'edit');
    const { id } = await params;
    const before = await prisma.boards_inventory.findFirst({ where: { id, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الصنف غير موجود' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['item_name', 'material_type', 'code', 'supplier_id', 'unit_price', 'quantity_in', 'date_added', 'linked_order_id', 'notes', 'used_price'];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات للتعديل' } }, { status: 400 });
    }
    // Normalize text fields
    if (data.material_type !== undefined) data.material_type = (data.material_type || '').trim();
    if (data.item_name !== undefined) data.item_name = (data.item_name || '').trim();
    data.updated_at = new Date();

    const item = await prisma.boards_inventory.update({ where: { id }, data });
    auditLog({ user_id: user.id, action: 'update', table_name: 'boards_inventory', row_id: id, before, after: item });

    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Board update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('boards_inventory', 'delete');
    const { id } = await params;
    const before = await prisma.boards_inventory.findFirst({ where: { id, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الصنف غير موجود' } }, { status: 404 });
    }

    await prisma.boards_inventory.update({ where: { id }, data: { deleted_at: new Date() } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'boards_inventory', row_id: id, before });

    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Board delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
