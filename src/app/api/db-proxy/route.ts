import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { COOKIE_NAME, verifySession } from '@/lib/db/auth';
import { executeDirect } from '@/lib/db/query-builder';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) {
    return NextResponse.json({ data: null, error: { message: 'غير مصرح' } }, { status: 401 });
  }

  const payload = await verifySession(match[1]);
  if (!payload) {
    return NextResponse.json({ data: null, error: { message: 'انتهت الجلسة' } }, { status: 401 });
  }

  try {
    let {
      table, method, columns = '*', filters = [], orders = [],
      limit = null, single = false, data = null, count = false, conflict = null, func = null,
    } = await request.json();

    // All tables are in the mazaya schema
    if (table) table = `mazaya.${table}`;

    return NextResponse.json(
      await executeDirect(table, method, { columns, filters, orders, limit, single, data, count, conflict, func })
    );
  } catch (e: any) {
    return NextResponse.json({ data: null, error: { message: e.message } }, { status: 500 });
  }
}
