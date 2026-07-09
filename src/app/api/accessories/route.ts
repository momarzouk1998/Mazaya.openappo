import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const material_type = searchParams.get('material_type') || '';
    const supplier_id = searchParams.get('supplier_id') || '';
    const offset = (page - 1) * limit;

    const where: any = { deleted_at: null };
    if (search) {
      where.OR = [
        { item_name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (material_type) where.material_type = material_type;
    if (supplier_id) where.supplier_id = supplier_id;

    const [total, data] = await Promise.all([
      prisma.accessories_inventory.count({ where }),
      prisma.accessories_inventory.findMany({
        where,
        include: { supplier: true },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const items = data.map(({ supplier, ...rest }) => ({ ...rest, supplier_name: supplier?.name || null }));

    return NextResponse.json({ ok: true, data: { items, total, page, limit } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Accessories list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { item_name, material_type, code, supplier_id, unit_price, quantity_in, date_added, linked_order_id, notes } = body;

    if (!item_name || !item_name.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'اسم الصنف مطلوب' } }, { status: 400 });
    }
    if (!unit_price || unit_price <= 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'سعر الوحدة مطلوب' } }, { status: 400 });
    }

    const autoCode = code?.trim() || `ACC-${Date.now().toString(36).toUpperCase()}`;

    const qty = quantity_in || 0;
    const item = await prisma.accessories_inventory.create({
      data: {
        item_name: item_name.trim(),
        material_type: material_type || '',
        code: autoCode,
        supplier_id: supplier_id || null,
        unit_price,
        quantity_in: qty,
        quantity_remaining: qty,
        total_price: qty * unit_price,
        date_added: date_added ? new Date(date_added) : new Date(),
        linked_order_id: linked_order_id || null,
        notes: notes || null,
        created_by: user.id,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'accessories_inventory', row_id: item.id, after: item });
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Accessory create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
