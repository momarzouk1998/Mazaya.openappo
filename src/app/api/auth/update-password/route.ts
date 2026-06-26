import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { hashPassword, COOKIE_NAME, verifySession } from '@/lib/db/auth';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) {
      return NextResponse.json({ data: null, error: { message: 'غير مصرح' } }, { status: 401 });
    }

    const payload = await verifySession(match[1]);
    if (!payload) {
      return NextResponse.json({ data: null, error: { message: 'انتهت الجلسة' } }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ data: null, error: { message: 'كلمة المرور مطلوبة' } }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await query('UPDATE mazaya.users SET password_hash = $1 WHERE id = $2', [passwordHash, payload.userId]);

    return NextResponse.json({ data: { user: { id: payload.userId } }, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e.message } }, { status: 500 });
  }
}
