import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { verifyPassword, createSession, getSessionCookie } from '@/lib/db/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ data: null, error: { message: 'البريد الإلكتروني وكلمة المرور مطلوبان' } }, { status: 400 });
    }

    const r = await query('SELECT id, email, name, role, branch_id, password_hash FROM mazaya.users WHERE email = $1', [email]);
    if (r.rows.length === 0) {
      return NextResponse.json({ data: null, error: { message: 'Invalid login credentials' } }, { status: 401 });
    }

    const user = r.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ data: null, error: { message: 'Invalid login credentials' } }, { status: 401 });
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        session: { access_token: token },
      },
      error: null,
    });
    response.headers.append('Set-Cookie', getSessionCookie(token));
    return response;
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e.message } }, { status: 500 });
  }
}
