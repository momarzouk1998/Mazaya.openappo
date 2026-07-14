import { NextResponse } from 'next/server';
import { requirePermission, requireAdmin } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('branches', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.branches.count({ where }),
      prisma.branches.findMany({ where, orderBy: { name: 'asc' }, skip: offset, take: limit }),
    ]);

    return NextResponse.json({ ok: true, data: { items, total, page, limit } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Branches list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'error' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const { name, location, phone, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'name required' } }, { status: 400 });
    }

    const existing = await prisma.branches.findFirst({ where: { name: name.trim() }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ ok: false, error: { code: 'CONFLICT', message: 'branch name exists' } }, { status: 409 });
    }

    const item = await prisma.branches.create({
      data: { name: name.trim(), location: location || null, phone: phone || null, notes: notes || null },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'branches', row_id: item.id, after: item });
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'auth error' } }, { status: e.status });
    console.error('Branch create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'error' } }, { status: 500 });
  }
}
