import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/db/auth';

export async function POST() {
  const response = NextResponse.json({ error: null });
  response.headers.append('Set-Cookie', clearSessionCookie());
  return response;
}
