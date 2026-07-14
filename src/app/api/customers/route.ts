import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('customers', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const branch_id = searchParams.get('branch_id') || '';
    const offset = (page - 1) * limit;

    const where: any = { deleted_at: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (branch_id) {
      where.branch_id = branch_id;
    }
    // Branch users only see their own branch customers
    if (user.role !== 'admin' && user.branch_id) {
      where.branch_id = user.branch_id;
    }

    const [items, total] = await Promise.all([
      prisma.customers.findMany({
        where,
        include: { branch: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.customers.count({ where }),
    ]);

    const mapped = items.map(({ branch, ...rest }: any) => ({
      ...rest,
      branch_name: branch?.name || null,
    }));

    return NextResponse.json({
      ok: true,
      data: { items: mapped, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Customers list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('customers', 'add');
    const body = await request.json();
    const { name, branch_id, phone, address, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'اسم العميل مطلوب' } }, { status: 400 });
    }

    const item = await prisma.customers.create({
      data: { name: name.trim(), branch_id: branch_id || null, phone: phone || null, address: address || null, notes: notes || null },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'customers', row_id: item.id, after: item as any });
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Customer create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
