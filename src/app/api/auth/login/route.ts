import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { verifyPassword, signSession, COOKIE_NAME } from '@/lib/db/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'اسم المستخدم وكلمة المرور مطلوبان' } },
        { status: 400 }
      );
    }

    const user = await prisma.users.findFirst({
      where: { username },
      select: { id: true, username: true, full_name: true, role: true, branch_id: true, password_hash: true, is_active: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'بيانات الدخول غير صحيحة' } },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'هذا الحساب معطّل. تواصل مع المدير.' } },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'بيانات الدخول غير صحيحة' } },
        { status: 401 }
      );
    }

    // Update last_login_at
    await prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });

    // Sign JWT
    const token = await signSession({
      id: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
    });

    const proto = request.headers.get('x-forwarded-proto') || '';
    const isSecure = request.url.startsWith('https:') || proto === 'https';
    const response = NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        branch_id: user.branch_id,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } },
      { status: 500 }
    );
  }
}
