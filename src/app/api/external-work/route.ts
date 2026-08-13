import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('orders', 'view');
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '500');

    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT oew.*, o.order_name, co.name as contractor_name 
       FROM mazaya.order_external_work oew 
       LEFT JOIN mazaya.orders o ON oew.order_id = o.id 
       LEFT JOIN mazaya.contractors co ON oew.contractor_id = co.id 
       ORDER BY oew.created_at DESC 
       LIMIT $1`,
      limit
    );

    const serialized = items.map((it) => ({
      id: it.id,
      order_id: it.order_id,
      order_name: it.order_name || '—',
      work_type: it.work_type || 'أخرى',
      contractor_id: it.contractor_id,
      contractor_name: it.contractor_name || '—',
      amount: Number(it.amount ?? 0),
      notes: it.notes || '',
      created_at: it.created_at,
    }));

    return NextResponse.json({
      ok: true,
      data: { items: serialized },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('External Work GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('orders', 'add');
    const body = await request.json();
    const { order_id, contractor_id, work_type, amount, notes } = body;

    if (!order_id) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'الأوردر مطلوب' } },
        { status: 400 }
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const contractorId = (contractor_id == null || contractor_id === "" || String(contractor_id) === "NaN")
      ? null
      : String(contractor_id);

    const result = await prisma.order_external_work.create({
      data: {
        order_id,
        contractor_id: contractorId,
        work_type: work_type || 'أخرى',
        amount: Number(amount),
        notes: notes || null,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'order_external_work', row_id: result.id, after: result });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('External Work POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
