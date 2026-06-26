import { query } from './pool';

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
interface Filter { col: string; op: FilterOp; val: any }
interface Order { col: string; ascending: boolean }
interface Join { alias: string; table: string; columns: string; fkCol: string }

const JOIN_RE = /(\w+):(\w+)\((\*|\w+(?:,\s*\w+)*)\)/g;

export function parseColumns(colSpec: string): { columns: string; joins: Join[] } {
  const joins: Join[] = [];
  if (!colSpec || colSpec === '*') return { columns: '*', joins };

  const parts = colSpec.split(', ').filter(Boolean);
  const mainCols: string[] = [];

  for (const part of parts) {
    const match = part.match(/(\w+):(\w+)\((\*|\w+(?:,\s*\w+)*)\)/);
    if (match) {
      joins.push({
        alias: match[1],
        table: match[2],
        columns: match[3],
        fkCol: `${match[1]}_id`,
      });
    } else if (part === '*') {
      mainCols.push('*');
    } else {
      mainCols.push(part);
    }
  }

  return { columns: mainCols.length ? mainCols.join(', ') : '*', joins };
}

function generateSelectSQL(
  table: string,
  columns: string,
  joins: Join[],
  filters: Filter[],
  orders: Order[],
  limitCount: number | null,
  countOnly: boolean
): { sql: string; params: any[] } {
  const paramValues: any[] = [];
  let paramIndex = 0;

  if (countOnly) {
    let sql = `SELECT COUNT(*) AS count FROM ${table} t`;
    const whereClauses = filters.map(f => {
      paramIndex++;
      paramValues.push(f.val);
      if (f.op === 'in') {
        const placeholders = (f.val as any[]).map((_, i) => `$${paramIndex + i}`).join(', ');
        paramIndex += (f.val as any[]).length - 1;
        paramValues.push(...(f.val as any[]));
        return `t.${f.col} IN (${placeholders})`;
      }
      return `t.${f.col} ${f.op === 'eq' ? '=' : f.op} $${paramIndex}`;
    });
    if (whereClauses.length) sql += ' WHERE ' + whereClauses.join(' AND ');
    return { sql, params: paramValues };
  }

  // Build SELECT with row_to_json for joins
  const selectParts: string[] = [];
  selectParts.push(`${table}.*`);

  joins.forEach((j, idx) => {
    const alias = `_j${idx}`;
    if (j.columns === '*') {
      selectParts.push(`row_to_json("${alias}".*) AS "${j.alias}"`);
    } else {
      const specificCols = j.columns.split(', ').map((c: string) => `"${alias}"."${c}"`).join(', ');
      selectParts.push(`row_to_json((SELECT ${specificCols} FROM "${alias}")) AS "${j.alias}"`);
    }
  });

  let sql = `SELECT ${selectParts.join(', ')} FROM ${table}`;

  // JOINs
  joins.forEach((j, idx) => {
    const alias = `_j${idx}`;
    sql += ` LEFT JOIN ${j.table} "${alias}" ON ${table}.${j.fkCol} = "${alias}".id`;
  });

  // WHERE
  if (filters.length) {
    const whereClauses = filters.map(f => {
      paramIndex++;
      paramValues.push(f.val);
      if (f.op === 'in') {
        const placeholders = (f.val as any[]).map((_, i) => `$${paramIndex + i}`).join(', ');
        paramIndex += (f.val as any[]).length - 1;
        paramValues.push(...(f.val as any[]));
        return `${table}.${f.col} IN (${placeholders})`;
      }
      const opMap: Record<string, string> = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE' };
      return `${table}.${f.col} ${opMap[f.op] || '='} $${paramIndex}`;
    });
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }

  // ORDER
  if (orders.length) {
    const orderClauses = orders.map(o => `${table}.${o.col} ${o.ascending ? 'ASC' : 'DESC'}`);
    sql += ' ORDER BY ' + orderClauses.join(', ');
  }

  // LIMIT
  if (limitCount) {
    sql += ` LIMIT ${limitCount}`;
  }

  return { sql, params: paramValues };
}

function generateInsertSQL(table: string, data: any): { sql: string; params: any[] } {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, params: vals };
}

function generateUpdateSQL(table: string, data: any, filters: Filter[]): { sql: string; params: any[] } {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const setClauses = cols.map((c, i) => `${c} = $${i + 1}`);
  const paramValues = [...vals];
  let paramIndex = vals.length;

  const whereClauses = filters.map(f => {
    paramIndex++;
    paramValues.push(f.val);
    return `${f.col} ${f.op === 'eq' ? '=' : f.op} $${paramIndex}`;
  });

  return { sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`, params: paramValues };
}

function generateDeleteSQL(table: string, filters: Filter[]): { sql: string; params: any[] } {
  const paramValues: any[] = [];
  const whereClauses = filters.map((f, i) => {
    paramValues.push(f.val);
    return `${f.col} ${f.op === 'eq' ? '=' : f.op} $${i + 1}`;
  });
  return { sql: `DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')}`, params: paramValues };
}

function generateUpsertSQL(table: string, data: any, conflictCol: string | null): { sql: string; params: any[] } {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const updates = cols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const conflict = conflictCol || cols[0];
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`,
    params: vals,
  };
}

function generateCountSQL(table: string, filters: Filter[]): { sql: string; params: any[] } {
  const paramValues: any[] = [];
  let sql = `SELECT COUNT(*) AS count FROM ${table}`;
  if (filters.length) {
    const whereClauses = filters.map((f, i) => {
      paramValues.push(f.val);
      if (f.op === 'in') {
        const placeholders = (f.val as any[]).map((_, j) => `$${i + 1 + j}`).join(', ');
        paramValues.push(...(f.val as any[]));
        return `${f.col} IN (${placeholders})`;
      }
      return `${f.col} ${f.op === 'eq' ? '=' : f.op} $${i + 1}`;
    });
    sql += ' WHERE ' + whereClauses.join(' AND ');
  }
  return { sql, params: paramValues };
}

function nestJoins(row: any, joins: Join[]): any {
  // With row_to_json, joins are already nested - no need to process
  return row;
}

export async function executeDirect(
  table: string,
  method: string,
  options: {
    columns?: string;
    filters?: Filter[];
    orders?: Order[];
    limit?: number | null;
    single?: boolean;
    data?: any;
    count?: boolean;
    conflict?: string | null;
    func?: string;
  }
): Promise<any> {
  const { columns = '*', filters = [], orders = [], limit = null, single = false, data = null, count = false, conflict = null, func } = options;

  try {
    let result;

    if (method === 'rpc' && func) {
      const schema = table && table.includes('.') ? table.substring(0, table.indexOf('.')) : 'mazaya';
      const r = await query(`SELECT * FROM ${schema}.${func}()`, []);
      return { data: r.rows, error: null, count: null };
    }

    const { columns: parsedCols, joins } = parseColumns(columns);

    // Add schema prefix to join tables
    const schema = table.includes('.') ? table.substring(0, table.indexOf('.') + 1) : '';
    for (const j of joins) {
      if (!j.table.includes('.')) {
        j.table = schema + j.table;
      }
    }

    if (method === 'select') {
      if (count && !single) {
        const { sql, params } = generateCountSQL(table, filters);
        const r = await query(sql, params);
        return { data: null, error: null, count: parseInt(r.rows[0].count, 10) };
      }

      const { sql, params } = generateSelectSQL(table, parsedCols, joins, filters, orders, limit, false);
      const r = await query(sql, params);

      let rows = r.rows.map((row: any) => nestJoins(row, joins));

      if (single) {
        return { data: rows[0] || null, error: null, count: rows.length };
      }
      return { data: rows, error: null, count: rows.length };
    }

    if (method === 'insert') {
      const { sql, params } = generateInsertSQL(table, data);
      const r = await query(`${sql} RETURNING *`, params);
      if (single) return { data: r.rows[0] || null, error: null, count: null };
      return { data: r.rows, error: null, count: null };
    }

    if (method === 'update') {
      const { sql, params } = generateUpdateSQL(table, data, filters);
      const r = await query(`${sql} RETURNING *`, params);
      return { data: r.rows, error: null, count: r.rowCount };
    }

    if (method === 'delete') {
      const { sql, params } = generateDeleteSQL(table, filters);
      const r = await query(`${sql} RETURNING *`, params);
      return { data: r.rows, error: null, count: r.rowCount };
    }

    if (method === 'upsert') {
      const { sql, params } = generateUpsertSQL(table, data, conflict);
      const r = await query(`${sql} RETURNING *`, params);
      if (single) return { data: r.rows[0] || null, error: null, count: null };
      return { data: r.rows, error: null, count: null };
    }

    return { data: null, error: { message: `Unknown method: ${method}` }, count: null };
  } catch (e: any) {
    return { data: null, error: { message: e.message }, count: null };
  }
}

export async function executeAsUser(
  table: string,
  method: string,
  options: any
): Promise<any> {
  return executeDirect(table, method, options);
}
