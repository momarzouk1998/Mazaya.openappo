import { Pool } from 'pg';

const globalPool = globalThis as any;
let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
} else {
  if (!globalPool.__dbPool) {
    globalPool.__dbPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  pool = globalPool.__dbPool;
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function transaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
