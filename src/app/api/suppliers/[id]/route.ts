import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('suppliers', 'view');
    const { id } = await params;
    const item = await prisma.suppliers.findFirst({ where: { id, deleted_at: null } });
    if (!item) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: '\u0627\u0644\u0645\u0648\u0631\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f' } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '\u062d\u062f\u062b \u062e\u0637\u0623' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('suppliers', 'edit');
    const { id } = await params;
    const intId = id;
    const before = await prisma.suppliers.findFirst({ where: { id: intId, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: '\u0627\u0644\u0645\u0648\u0631\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['name', 'payment_type', 'phone', 'notes'];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0644\u062a\u0639\u062f\u064a\u0644' } }, { status: 400 });
    }
    data.updated_at = new Date();

    const item = await prisma.suppliers.update({ where: { id: intId }, data });
    auditLog({ user_id: user.id, action: 'update', table_name: 'suppliers', row_id: intId, before: before as any, after: item as any });

    return NextResponse.json({ ok: true, data: item });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Supplier update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '\u062d\u062f\u062b \u062e\u0637\u0623' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('suppliers', 'delete');
    const { id } = await params;
    const intId = id;
    const before = await prisma.suppliers.findFirst({ where: { id: intId, deleted_at: null } });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: '\u0627\u0644\u0645\u0648\u0631\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f' } }, { status: 404 });
    }

    await prisma.suppliers.update({ where: { id: intId }, data: { deleted_at: new Date() } });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'suppliers', row_id: intId, before: before as any });

    return NextResponse.json({ ok: true, data: { message: '\u062a\u0645 \u0627\u0644\u062d\u0630\u0641' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Supplier delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || '\u062d\u062f\u062b \u062e\u0637\u0623' } }, { status: 500 });
  }
}
