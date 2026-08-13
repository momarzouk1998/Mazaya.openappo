import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('orders', 'delete');
    const { id } = await params;

    const before = await prisma.order_external_work.findFirst({
      where: { id },
    });

    if (!before) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'سجل العمل الخارجي غير موجود' } },
        { status: 404 }
      );
    }

    await prisma.order_external_work.delete({
      where: { id },
    });

    auditLog({ user_id: user.id, action: 'delete', table_name: 'order_external_work', row_id: id, before });

    return NextResponse.json({ ok: true, message: 'تم حذف العمل الخارجي بنجاح' });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('External Work DELETE error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
