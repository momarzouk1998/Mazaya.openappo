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
    const user = await requirePermission('journal', 'delete');
    const { id } = await params;

    const overhead = await prisma.overhead_expenses.findFirst({
      where: {
        OR: [
          { id },
          { journal_entry_id: id },
        ],
        category: 'مصاريف ليد',
      },
    });

    if (!overhead) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'سجل مصاريف الليد غير موجود' } },
        { status: 404 }
      );
    }

    const journalEntryId = overhead.journal_entry_id;

    await prisma.$transaction(async (tx) => {
      await tx.overhead_expenses.delete({ where: { id: overhead.id } });

      if (journalEntryId) {
        await tx.journal_entries.delete({ where: { id: journalEntryId } });
      }
    });

    auditLog({ user_id: user.id, action: 'delete', table_name: 'overhead_expenses', row_id: overhead.id });

    return NextResponse.json({ ok: true, message: 'تم الحذف بنجاح' });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('LED Expenses DELETE error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
