import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('workers', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '500');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const where: any = { deleted_at: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.workers.findMany({ where, orderBy: { name: 'asc' }, skip: offset, take: limit }),
      prisma.workers.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: { items, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Workers list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('workers', 'add');
    const body = await request.json();
    const { name, phone, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'اسم العامل مطلوب' } }, { status: 400 });
    }

    const item = await prisma.workers.create({
      data: { name: name.trim(), phone: phone || null, notes: notes || null },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'workers', row_id: item.id, after: item as any });
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Worker create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
