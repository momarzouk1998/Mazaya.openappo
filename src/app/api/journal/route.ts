import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';
import { VALID_ENTRY_TYPES, VALID_PAYMENT_METHODS } from '@/lib/finance';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const entry_type = searchParams.get('entry_type') || '';
    const payment_method = searchParams.get('payment_method') || '';
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    const order_id = searchParams.get('order_id') || '';

    const where: any = {};
    if (entry_type) where.entry_type = entry_type;
    if (payment_method) where.payment_method = payment_method;
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (order_id) where.order_id = order_id;

    const total = await prisma.journal_entries.count({ where });

    const conditions: string[] = ['1=1'];
    const rawParams: any[] = [];
    let paramIdx = 1;

    if (entry_type) {
      conditions.push(`je.entry_type = $${paramIdx++}`);
      rawParams.push(entry_type);
    }
    if (payment_method) {
      conditions.push(`je.payment_method = $${paramIdx++}`);
      rawParams.push(payment_method);
    }
    if (date_from) {
      conditions.push(`je.date >= $${paramIdx++}`);
      rawParams.push(date_from);
    }
    if (date_to) {
      conditions.push(`je.date <= $${paramIdx++}`);
      rawParams.push(date_to);
    }
    if (search) {
      conditions.push(`je.description ILIKE $${paramIdx++}`);
      rawParams.push(`%${search}%`);
    }
    if (order_id) {
      conditions.push(`je.order_id = $${paramIdx++}::uuid`);
      rawParams.push(order_id);
    }

    // F10 — Branch scoping: لو المستخدم مش admin، نقتصر على القيود
    // المرتبطة بأوردرات في فروعه (عن طريق order_id). باقي القيود
    // (التمريرية، النثريات بدون أوردر) لا تظهر للمستخدمين غير الإداريين
    // لأن جدول journal_entries مافيش فيه branch_id في الـ schema الحالي.
    if (user.role !== 'admin' && user.branch_id) {
      conditions.push(`(je.order_id IS NULL OR je.order_id IN (
        SELECT o.id FROM mazaya.orders o WHERE o.branch_id = $${paramIdx++}::uuid
      ))`);
      rawParams.push(user.branch_id);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const entries: any[] = await prisma.$queryRawUnsafe(
      `SELECT je.*,
        CASE
          WHEN je.party_type = 'supplier' THEN s.name
          WHEN je.party_type = 'branch' THEN b.name
          WHEN je.party_type = 'contractor' THEN c.name
          ELSE NULL
        END as party_name
       FROM mazaya.journal_entries je
       LEFT JOIN mazaya.suppliers s ON je.party_type = 'supplier' AND je.party_id = s.id
       LEFT JOIN mazaya.branches b ON je.party_type = 'branch' AND je.party_id = b.id
       LEFT JOIN mazaya.contractors c ON je.party_type = 'contractor' AND je.party_id = c.id
       ${whereClause}
       ORDER BY je.date DESC, je.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      ...rawParams, limit, offset
    );

    const serialized = entries.map((e: any) => ({ ...e, amount: Number(e.amount) }));

    return NextResponse.json({
      ok: true,
      data: {
        entries: serialized,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const {
      description, amount, entry_type, payment_method,
      party_type, party_id, order_id, date, notes,
      // يدعم الفورم اللي بيبعت الأطراف بأسماء مستقلة
      branch_id, supplier_id, contractor_id,
      is_passthrough,
    } = body;

    if (!description || description.trim() === '') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'الوصف مطلوب' } },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    // SSoT (F8) — مصدر واحد لـ entry_types من src/lib/finance.ts
    // لا نقبل المفاتيح الإنجليزية بعد الآن.
    if (!entry_type || !(VALID_ENTRY_TYPES as readonly string[]).includes(entry_type)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'نوع القيد غير صالح' } },
        { status: 400 }
      );
    }

    if (payment_method && !(VALID_PAYMENT_METHODS as readonly string[]).includes(payment_method)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'طريقة الدفع غير صالحة' } },
        { status: 400 }
      );
    }

    if (party_type && !['supplier', 'branch', 'contractor'].includes(party_type)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'نوع الطرف غير صالح' } },
        { status: 400 }
      );
    }

    const entryDate = date ? new Date(date) : new Date();
    const cleanDesc = description.trim();

    // ============================================================
    // الحالة الخاصة: التحويل التمريري (Pass-through)
    // المعرض حوّل مباشرة للمورد → نسجل حركتين:
    //   1) دفعة واردة من المعرض (تزيد الرصيد)
    //   2) دفعة صادرة للمورد (تنقص الرصيد)
    // الاتنين بنفس المبلغ، فالصافي = صفر، لكن السجل يبقى صحيح.
    // ============================================================
    const isPass = Boolean(is_passthrough)
      || entry_type === 'تحويل تمريري'
      || entry_type === 'transfer';

    if (isPass) {
      if (!branch_id || !supplier_id) {
        return NextResponse.json(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: 'التحويل التمريري يتطلب اختيار المعرض والمورد' } },
          { status: 400 }
        );
      }

      const [incoming, outgoing] = await prisma.$transaction([
        prisma.journal_entries.create({
          data: {
            date: entryDate,
            entry_type: 'دفعة واردة من معرض',
            description: `[تمريري] ${cleanDesc}`,
            amount,
            payment_method: payment_method || null,
            party_type: 'branch',
            party_id: branch_id,
            order_id: order_id || null,
            is_pass_through: true,
            notes: notes || null,
            created_by: user.id,
          },
        }),
        prisma.journal_entries.create({
          data: {
            date: entryDate,
            entry_type: 'دفعة صادرة لمورد',
            description: `[تمريري] ${cleanDesc}`,
            amount,
            payment_method: payment_method || null,
            party_type: 'supplier',
            party_id: supplier_id,
            order_id: order_id || null,
            is_pass_through: true,
            notes: notes || null,
            created_by: user.id,
          },
        }),
      ]);

      auditLog({ user_id: user.id, action: 'create', table_name: 'journal_entries', row_id: incoming.id, after: incoming });
      auditLog({ user_id: user.id, action: 'create', table_name: 'journal_entries', row_id: outgoing.id, after: outgoing });

      return NextResponse.json({
        ok: true,
        data: { pass_through: true, incoming: { ...incoming, amount: Number(incoming.amount) }, outgoing: { ...outgoing, amount: Number(outgoing.amount) } },
      }, { status: 201 });
    }

    // ============================================================
    // الحالة العادية: قيد واحد
    // لو الفورم بعت branch_id/supplier_id/contractor_id بدون party_type،
    // اشتقّ party_type/party_id تلقائياً عشان الفورم يشتغل صح.
    // ============================================================
    let resolvedPartyType = party_type || null;
    let resolvedPartyId = party_id || null;

    if (!resolvedPartyType) {
      if (branch_id)        { resolvedPartyType = 'branch';     resolvedPartyId = branch_id; }
      else if (supplier_id) { resolvedPartyType = 'supplier';   resolvedPartyId = supplier_id; }
      else if (contractor_id) { resolvedPartyType = 'contractor'; resolvedPartyId = contractor_id; }
    }

    const entry = await prisma.journal_entries.create({
      data: {
        date: entryDate,
        entry_type,
        description: cleanDesc,
        amount,
        payment_method: payment_method || null,
        party_type: resolvedPartyType,
        party_id: resolvedPartyId,
        order_id: order_id || null,
        notes: notes || null,
        created_by: user.id,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'journal_entries', row_id: entry.id, after: entry });

    return NextResponse.json({ ok: true, data: { ...entry, amount: Number(entry.amount) } }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
