interface DbResult { data: any; error: any; count?: number | null }

class BrowserDbQuery implements PromiseLike<DbResult> {
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
    const body: any = {
      table: this.table,
      method: this.method,
      columns: this.columns,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitCount,
      single: this.countConfig?.head ? false : this.isSingle,
      data: this.insertData,
      count: this.countConfig?.count === 'exact' && !this.isSingle,
      conflict: this.conflictCol,
    };

    try {
      const res = await fetch('/api/db-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (e: any) {
      return { data: null, error: { message: e.message }, count: null };
    }
  }
}

export function createClient() {
  const baseUrl = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_SITE_URL || '';

  return {
    from: (table: string) => new BrowserDbQuery(table),

    rpc: (fn: string, _params?: any) => {
      const q = new BrowserDbQuery('');
      q.then = function <TResult1 = DbResult, TResult2 = never>(
        onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
      ): PromiseLike<TResult1 | TResult2> {
        return executeRpc(fn, baseUrl).then(onfulfilled as any, onrejected as any);
      };
      return q;
    },

    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        try {
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          return res.json();
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      },

      signOut: async () => {
        try {
          await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
          return { error: null };
        } catch {
          return { error: null };
        }
      },

      getUser: async () => {
        try {
          const res = await fetch(`${baseUrl}/api/auth/user`);
          return res.json();
        } catch (e: any) {
          return { data: { user: null }, error: { message: e.message } };
        }
      },

      signUp: async ({ email, password, options }: any) => {
        try {
          const res = await fetch(`${baseUrl}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, options }),
          });
          return res.json();
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      },

      updateUser: async ({ password }: { password: string }) => {
        try {
          const res = await fetch(`${baseUrl}/api/auth/update-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          });
          return res.json();
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      },

      admin: {
        createUser: async (params: any) => {
          try {
            const res = await fetch(`${baseUrl}/api/admin/create-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
            });
            return res.json();
          } catch (e: any) {
            return { data: null, error: { message: e.message } };
          }
        },
      },
    },
  };
}

async function executeRpc(fn: string, baseUrl: string): Promise<DbResult> {
  try {
    const res = await fetch(`${baseUrl}/api/db-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: '', method: 'rpc', func: fn }),
    });
    return res.json();
  } catch (e: any) {
    return { data: null, error: { message: e.message } };
  }
}
