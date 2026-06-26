import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { COOKIE_NAME, verifySession } from '@/lib/db/auth';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return NextResponse.json({ data: { user: null }, error: null });
  }

  const payload = await verifySession(match[1]);
  if (!payload) {
    return NextResponse.json({ data: { user: null }, error: null });
  }

  const r = await query('SELECT id, email, name, role, branch_id, created_at FROM mazaya.users WHERE id = $1', [payload.userId]);
  if (r.rows.length === 0) {
    return NextResponse.json({ data: { user: null }, error: null });
  }

  const user = r.rows[0];
  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { name: user.name },
        role: user.role,
        app_metadata: {},
      },
    },
    error: null,
  });
}
