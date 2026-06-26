import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { hashPassword, COOKIE_NAME, verifySession } from '@/lib/db/auth';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const payload = await verifySession(match[1]);
    if (!payload) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const adminCheck = await query('SELECT role FROM mazaya.users WHERE id = $1', [payload.userId]);
    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { email, password, name, role } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور والاسم مطلوبون' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM mazaya.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'User already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const r = await query(
      'INSERT INTO mazaya.users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, passwordHash, name, role || 'admin']
    );
    const userId = r.rows[0].id;

    await query(
      'INSERT INTO mazaya.admin_permissions (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [userId]
    );

    return NextResponse.json({ success: true, user: { id: userId, email } });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
