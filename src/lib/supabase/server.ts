import { cookies } from 'next/headers';
import { query } from '@/lib/db/pool';
import { COOKIE_NAME, verifySession } from '@/lib/db/auth';
import { executeDirect } from '@/lib/db/query-builder';

interface DbResult { data: any; error: any; count?: number | null }

class ServerDbQuery implements PromiseLike<DbResult> {
  private table: string;
  private method: string = 'select';
  private columns: string = '*';
  private filters: { col: string; op: string; val: any }[] = [];
  private orders: { col: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private countConfig: { count: string; head: boolean } | null = null;
  private insertData: any = null;
  private conflictCol: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: any, opts?: any) {
    this.method = 'select';
    if (typeof cols === 'string') this.columns = cols;
    if (opts?.count === 'exact') this.countConfig = opts;
    return this;
  }

  eq(col: string, val: any) { this.filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: 'neq', val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: 'gt', val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: 'gte', val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: 'lt', val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: 'lte', val }); return this; }
  like(col: string, val: any) { this.filters.push({ col, op: 'like', val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ col, op: 'in', val: vals }); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) { this.limitCount = n; return this; }
  single() { this.isSingle = true; return this; }

  insert(data: any) { this.method = 'insert'; this.insertData = data; return this; }
  update(data: any) { this.method = 'update'; this.insertData = data; return this; }
  delete() { this.method = 'delete'; return this; }
  upsert(data: any, opts?: { onConflict?: string }) {
    this.method = 'upsert'; this.insertData = data;
    this.conflictCol = opts?.onConflict || null;
    return this;
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async execute(): Promise<DbResult> {
    try {
      return await executeDirect(
        `mazaya.${this.table}`,
        this.method,
        {
          columns: this.columns,
          filters: this.filters as any,
          orders: this.orders,
          limit: this.limitCount,
          single: this.countConfig?.head ? false : this.isSingle,
          data: this.insertData,
          count: this.countConfig?.count === 'exact' && !this.isSingle,
          conflict: this.conflictCol,
        }
      );
    } catch (e: any) {
      return { data: null, error: { message: e.message }, count: null };
    }
  }
}

let _cachedUserId: number | null = null;

export async function createClient() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  let userId: number | null = null;
  if (sessionCookie) {
    const payload = await verifySession(sessionCookie);
    if (payload) userId = payload.userId;
  }
  _cachedUserId = userId;

  return {
    from: (table: string) => new ServerDbQuery(table),

    rpc: (fn: string, _params?: any) => {
      const q = new ServerDbQuery('');
      q.then = function <TResult1 = DbResult, TResult2 = never>(
        onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
      ): PromiseLike<TResult1 | TResult2> {
        return executeRpcDb(fn).then(onfulfilled as any, onrejected as any);
      };
      return q;
    },

    auth: {
      getUser: async () => {
        if (!userId) return { data: { user: null }, error: null };
        const r = await query('SELECT id, email, name, role, branch_id FROM mazaya.users WHERE id = $1', [userId]);
        if (r.rows.length === 0) return { data: { user: null }, error: null };
        const u = r.rows[0];
        return {
          data: { user: { id: u.id, email: u.email, user_metadata: { name: u.name }, app_metadata: {} } },
          error: null,
        };
      },
    },
  };
}

export function getCurrentUserId(): number | null {
  return _cachedUserId;
}

async function executeRpcDb(fn: string): Promise<DbResult> {
  try {
    const r = await query(`SELECT * FROM mazaya.${fn}()`, []);
    return { data: r.rows, error: null, count: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message }, count: null };
  }
}
