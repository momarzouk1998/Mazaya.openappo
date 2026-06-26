import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { hashPassword } from '@/lib/db/auth';
import { COOKIE_NAME, verifySession, createSession, getSessionCookie } from '@/lib/db/auth';

export async function POST(request: Request) {
  try {
    const { email, password, options } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ data: null, error: { message: 'البريد الإلكتروني وكلمة المرور مطلوبان' } }, { status: 400 });
    }

    const existing = await query('SELECT id FROM mazaya.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ data: null, error: { message: 'User already registered' } }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const name = options?.data?.name || email.split('@')[0];

    const r = await query(
      'INSERT INTO mazaya.users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, passwordHash, name, 'branch']
    );
    const userId = r.rows[0].id;

    const token = await createSession(userId);
    const response = NextResponse.json({
      data: { user: { id: userId, email: email, role: 'branch' } },
      error: null,
    });
    response.headers.append('Set-Cookie', getSessionCookie(token));
    return response;
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e.message } }, { status: 500 });
  }
}
