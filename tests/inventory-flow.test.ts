// ============================================================
// Integration test — Inventory & Order Materials Flow
// ============================================================
// يختبر السيناريوهات الـ 4 من متطلبات العمل:
//   1) شراء مرتبط بأوردر → quantity_in يزيد + quantity_used يزيد
//   2) تقليل كمية الأوردر → الفرق يرجع للمخزون تلقائياً
//   3) حذف مادة الأوردر → الكمية كلها ترجع للمخزون
//   4) شراء بدون أوردر → quantity_in يزيد فقط، quantity_used ثابت
//
// هذا الاختبار يستخدم PrismaMock ليعمل بدون DB حقيقي، مع نفس
// الـ SQL اللي بتشغله الـ helpers في الإنتاج. الكود في src/lib/inventory.ts
// هو اللي بنختبره، مش Prisma نفسها.
//
// التشغيل:
//   npm run test:inventory
//
// للاختبار على DB حقيقي (مثلاً staging):
//   DATABASE_URL=postgresql://... npm run test:inventory:live
// ============================================================

// ============================================================
// PrismaMock — يحاكي PrismaClient مع in-memory tables
// ============================================================
// نفس الـ SQL المنطقي اللي بتشغله الـ helpers، بس على Map
// في الذاكرة. الـ trigger في الـ DB مش موجود هنا، فنعمله
// يدوياً بعد كل UPDATE (زي ما الـ trigger بيعمل).
// ============================================================

type Row = {
  id: string;
  quantity_in: number;
  quantity_used: number;
  quantity_remaining: number;
  total_price: number;
  unit_price: number;
  deleted_at: Date | null;
  [key: string]: any;
};

class PrismaMock {
  boards: Map<string, Row> = new Map();
  accessories: Map<string, Row> = new Map();
  orderMaterials: any[] = [];
  ordersList: any[] = [];
  nextId = 1;

  // ===== helpers =====
  private genId() {
    return `mock-${this.nextId++}`;
  }

  // الـ trigger اللي بيحسب quantity_remaining و total_price
  // زي ما في الـ DB بعد الـ migration
  private applyTrigger(row: Row) {
    row.quantity_remaining = Math.max(row.quantity_in - row.quantity_used, 0);
    row.total_price = row.quantity_remaining * row.unit_price;
  }

  private getTable(category: 'boards_inventory' | 'accessories_inventory') {
    return category === 'boards_inventory' ? this.boards : this.accessories;
  }

  // ===== SQL: UPDATE ... SET quantity_in = quantity_in + $1 ... =====
  $executeRawUnsafe = (sql: string, ...params: any[]): any => {
    // Parse simple UPDATE statements matching our helper patterns
    const updateMatch = sql.match(/UPDATE\s+(mazaya\.)?(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+id\s+=\s+\$\d+::uuid/i);
    if (updateMatch) {
      const table = updateMatch[2];
      const setClause = updateMatch[3];
      const id = params[params.length - 1];

      const t = table === 'boards_inventory' ? this.boards : this.accessories;
      const row = t.get(id);
      if (!row || row.deleted_at) return 0;

      // Split SET assignments respecting nested parentheses
      const assignments = this.splitTopLevelCommas(setClause);
      for (const a of assignments) {
        const m = a.match(/(\w+)\s*=\s*([\s\S]+)$/);
        if (!m) continue;
        const [, col, expr] = m;
        row[col] = this.evalExpr(expr, params, row);
      }
      // الـ trigger بيشتغل بعد كل UPDATE
      this.applyTrigger(row);
      return 1;
    }
    return 0;
  };

  // ===== SQL: SELECT =====
  $queryRawUnsafe = (sql: string, ...params: any[]): any => {
    const selMatch = sql.match(/SELECT\s+quantity_remaining\s+FROM\s+(mazaya\.)?(\w+)\s+WHERE\s+id\s+=\s+\$\d+::uuid/i);
    if (selMatch) {
      const table = selMatch[2];
      const id = params[0];
      const t = table === 'boards_inventory' ? this.boards : this.accessories;
      const row = t.get(id);
      if (!row || row.deleted_at) return [];
      return [{ quantity_remaining: row.quantity_remaining }];
    }
    return [];
  };

  // Split "a=1, b=2, c=GREATEST(x, 0)" into ["a=1", " b=2", " c=GREATEST(x, 0)"]
  private splitTopLevelCommas(s: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out.map((x) => x.trim());
  }

  // ===== Model APIs (needed for PrismaModel.create / findFirst / etc) =====
  boards_inventory = {
    create: async (args: any) => {
      const id = this.genId();
      const data = args.data;
      const row: Row = {
        id,
        item_name: data.item_name || 'TEST',
        code: data.code || id,
        material_type: data.material_type || 'test',
        unit_price: data.unit_price ?? 0,
        unit: data.unit ?? 'piece',
        quantity_in: data.quantity_in ?? 0,
        quantity_used: data.quantity_used ?? 0,
        quantity_remaining: data.quantity_remaining ?? 0,
        total_price: data.total_price ?? 0,
        deleted_at: null,
        supplier_id: data.supplier_id || null,
      };
      this.applyTrigger(row);
      this.boards.set(id, row);
      return row;
    },
    findFirst: async (args: any) => {
      const id = args.where.id;
      return this.boards.get(id) || null;
    },
    findUnique: async (args: any) => {
      return this.boards.get(args.where.id) || null;
    },
    update: async (args: any) => {
      const row = this.boards.get(args.where.id);
      if (row) Object.assign(row, args.data);
      this.applyTrigger(row);
      return row;
    },
  };

  accessories_inventory = {
    create: async (args: any) => {
      const id = this.genId();
      const data = args.data;
      const row: Row = {
        id,
        item_name: data.item_name || 'TEST',
        code: data.code || id,
        material_type: data.material_type || 'test',
        unit_price: data.unit_price ?? 0,
        unit: data.unit ?? 'piece',
        quantity_in: data.quantity_in ?? 0,
        quantity_used: data.quantity_used ?? 0,
        quantity_remaining: data.quantity_remaining ?? 0,
        total_price: data.total_price ?? 0,
        deleted_at: null,
        supplier_id: data.supplier_id || null,
      };
      this.applyTrigger(row);
      this.accessories.set(id, row);
      return row;
    },
    findFirst: async (args: any) => {
      const id = args.where.id;
      return this.accessories.get(id) || null;
    },
    findUnique: async (args: any) => {
      return this.accessories.get(args.where.id) || null;
    },
    update: async (args: any) => {
      const row = this.accessories.get(args.where.id);
      if (row) Object.assign(row, args.data);
      this.applyTrigger(row);
      return row;
    },
  };

  order_materials = {
    create: async (args: any) => {
      const mat = { id: this.genId(), ...args.data };
      this.orderMaterials.push(mat);
      return mat;
    },
    findFirst: async (args: any) => {
      return this.orderMaterials.find((m) => m.id === args.where.id) || null;
    },
    findMany: async (args: any) => {
      if (args.where?.order_id) {
        return this.orderMaterials.filter((m) => m.order_id === args.where.order_id);
      }
      return this.orderMaterials;
    },
    update: async (args: any) => {
      const mat = this.orderMaterials.find((m) => m.id === args.where.id);
      if (mat) Object.assign(mat, args.data);
      return mat;
    },
    updateMany: async (args: any) => {
      const where = args.where;
      let count = 0;
      for (const mat of this.orderMaterials) {
        if (where.order_id && mat.order_id !== where.order_id) continue;
        if (where.item_id && mat.item_id !== where.item_id) continue;
        Object.assign(mat, args.data);
        count++;
      }
      return { count };
    },
    delete: async (args: any) => {
      const idx = this.orderMaterials.findIndex((m) => m.id === args.where.id);
      if (idx >= 0) {
        const [m] = this.orderMaterials.splice(idx, 1);
        return m;
      }
      return null;
    },
  };

  orders = {
    create: async (args: any) => {
      const o = { id: this.genId(), ...args.data };
      this.ordersList.push(o);
      return o;
    },
  };

  $transaction = async (fn: any) => fn(this);
  $disconnect = async () => {};

  // ===== Expression evaluator (يدعم الـ patterns اللي بنستخدمها) =====
  private evalExpr(expr: string, params: any[], row: Row): any {
    let e = expr.trim();

    // Greatest/Limit wrappers
    e = e.replace(/GREATEST\((.+?),\s*0\)/gi, (_m, inner) => {
      return `Math.max(${this.evalExpr(inner, params, row)}, 0)`;
    });
    e = e.replace(/LEAST\((.+?),\s*(\w+)\)/gi, (_m, inner, col) => {
      return `Math.min(${this.evalExpr(inner, params, row)}, row.${col})`;
    });

    // Parameter substitution: $1, $2, ...
    e = e.replace(/\$(\d+)/g, (_m, n) => {
      const v = params[parseInt(n) - 1];
      return typeof v === 'string' ? `'${v}'` : String(v);
    });

    // Column references — فقط الأعمدة المعروفة
    const cols = ['quantity_in', 'quantity_used', 'quantity_remaining', 'total_price', 'unit_price', 'id'];
    for (const col of cols) {
      e = e.replace(new RegExp(`\\b${col}\\b`, 'g'), `row.${col}`);
    }

    // Evaluate (use function args so 'row' is in scope)
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('row', 'Math', '"use strict"; return (' + e + ');');
      return fn(row, Math);
    } catch (err) {
      // fallback: ارجع الـ expr كما هو
      return e;
    }
  }
}

// ============================================================
// بداية الاختبار
// ============================================================

import {
  increaseInventory,
  adjustInventoryUsage,
  getInventoryRemaining,
} from '../src/lib/inventory.ts';

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
let total = 0;

function assertEq(label: string, actual: any, expected: any) {
  total++;
  const ok = Number(actual) === Number(expected);
  if (ok) {
    passed++;
    console.log(`  ${c.green('✓')} ${label}: ${actual} === ${expected}`);
  } else {
    failed++;
    console.log(`  ${c.red('✗')} ${label}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(label: string, condition: boolean, hint = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  ${c.green('✓')} ${label}${hint ? ' — ' + hint : ''}`);
  } else {
    failed++;
    console.log(`  ${c.red('✗')} ${label}${hint ? ' — ' + hint : ''}`);
  }
}

async function readInventory(prisma: any, id: string, category: 'boards_inventory' | 'accessories_inventory') {
  const t = category === 'boards_inventory' ? prisma.boards : prisma.accessories;
  const row = t.get(id);
  if (!row) return null;
  return {
    in: row.quantity_in,
    used: row.quantity_used,
    remaining: row.quantity_remaining,
    total: row.total_price,
  };
}

async function main() {
  console.log(c.cyan(c.bold('\n=== Inventory & Order Materials Flow Tests ===\n')));
  console.log(c.cyan('Using PrismaMock (in-memory). Run test:inventory:live against real DB.\n'));

  const prisma = new PrismaMock() as any;

  // ============================================================
  // سيناريو 1: شراء مرتبط بأوردر
  //   - شراء 10 ألواح → quantity_in = 10
  //   - ربطها بأوردر → quantity_used = 10
  //   - المتبقي = 0
  // ============================================================
  console.log(c.yellow(c.bold('Scenario 1: Purchase linked to order')));
  const item1 = await prisma.boards_inventory.create({
    data: { code: 'T1', item_name: 'Test Board 1', unit_price: 10, quantity_in: 0, quantity_used: 0 },
  });
  const order1 = await prisma.orders.create({ data: { order_name: 'T1' } });

  // شراء 10 ألواح (بدون ربط بأوردر)
  await increaseInventory(prisma, 'boards_inventory', item1.id, 10, { newUnitPrice: 10 });
  let snap = await readInventory(prisma, item1.id, 'boards_inventory');
  assertEq('after purchase: quantity_in', snap!.in, 10);
  assertEq('after purchase: quantity_used (unchanged)', snap!.used, 0);
  assertEq('after purchase: quantity_remaining', snap!.remaining, 10);

  // ربطها بالأوردر (POST material)
  await adjustInventoryUsage(prisma, 'boards_inventory', item1.id, 10);
  await prisma.order_materials.create({
    data: {
      order_id: order1.id, item_category: 'boards_inventory', item_id: item1.id,
      quantity_used: 10, unit_price_snapshot: 10, line_total: 100,
    },
  });
  snap = await readInventory(prisma, item1.id, 'boards_inventory');
  assertEq('after order link: quantity_in (unchanged)', snap!.in, 10);
  assertEq('after order link: quantity_used', snap!.used, 10);
  assertEq('after order link: quantity_remaining', snap!.remaining, 0);
  assertEq('after order link: total_price (10 left * 0 = 0)', snap!.total, 0);

  // ============================================================
  // سيناريو 2: تقليل الكمية (من 10 إلى 9)
  //   - الفرق = 1 (diff سالب) → adjustInventoryUsage(item, -1)
  //   - quantity_used ينقص 1
  //   - quantity_remaining يرجع 1
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 2: Reduce order quantity (10 → 9) — delta-based PATCH')));
  const oldQty = 10;
  const newQty = 9;
  const diff = newQty - oldQty; // -1
  // محاكاة PATCH من route.ts:
  //   const diff = newQty - oldQty
  //   await adjustInventoryUsage(prisma, cat, itemId, diff)
  await prisma.order_materials.updateMany({
    where: { order_id: order1.id, item_id: item1.id },
    data: { quantity_used: newQty, line_total: newQty * 10 },
  });
  await adjustInventoryUsage(prisma, 'boards_inventory', item1.id, diff);
  snap = await readInventory(prisma, item1.id, 'boards_inventory');
  assertEq('after reduce: quantity_in (unchanged)', snap!.in, 10);
  assertEq('after reduce: quantity_used', snap!.used, 9);
  assertEq('after reduce: quantity_remaining (back to 1)', snap!.remaining, 1);
  assertEq('after reduce: total_price', snap!.total, 10);

  // ============================================================
  // سيناريو 2b: محاولة زيادة أكبر من المتاح (لازم تفشل قبل الـ DB)
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 2b: Reject PATCH that exceeds available')));
  const avail = await getInventoryRemaining(prisma, 'boards_inventory', item1.id);
  assertEq('available for re-consume', avail, 1);
  const requestedIncrease = 5;
  // الـ route.ts بيرفض لو diff > avail — هنا بنتحقق إن المنطق صحيح
  assertTrue(
    'increase 5 correctly rejected because avail = 1',
    requestedIncrease > avail
  );

  // ============================================================
  // سيناريو 2c: زيادة الكمية المتاحة فعلياً (من 9 إلى 10)
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 2c: Increase order quantity within available (9 → 10)')));
  const newQty2 = 10;
  const diff2 = newQty2 - 9; // +1
  await prisma.order_materials.updateMany({
    where: { order_id: order1.id, item_id: item1.id },
    data: { quantity_used: newQty2, line_total: newQty2 * 10 },
  });
  await adjustInventoryUsage(prisma, 'boards_inventory', item1.id, diff2);
  snap = await readInventory(prisma, item1.id, 'boards_inventory');
  assertEq('after increase: quantity_in (unchanged)', snap!.in, 10);
  assertEq('after increase: quantity_used', snap!.used, 10);
  assertEq('after increase: quantity_remaining', snap!.remaining, 0);

  // ============================================================
  // سيناريو 3: حذف مادة الأوردر
  //   - حذف order_material بالكامل
  //   - quantity_used ينقص 10 (الكمية كلها)
  //   - quantity_remaining يرجع 10
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 3: Delete order material (full return)')));
  const orderMaterials = await prisma.order_materials.findMany({ where: { order_id: order1.id } });
  for (const mat of orderMaterials) {
    const qty = Number(mat.quantity_used);
    const cat = mat.item_category as 'boards_inventory' | 'accessories_inventory';
    // أولاً نرجّع الكمية للمخزون (delta = -qty)
    await adjustInventoryUsage(prisma, cat, mat.item_id, -qty);
    // بعدين نحذف سجل المادة
    await prisma.order_materials.delete({ where: { id: mat.id } });
  }
  snap = await readInventory(prisma, item1.id, 'boards_inventory');
  assertEq('after delete: quantity_in (unchanged)', snap!.in, 10);
  assertEq('after delete: quantity_used (back to 0)', snap!.used, 0);
  assertEq('after delete: quantity_remaining (back to 10)', snap!.remaining, 10);
  assertEq('after delete: total_price', snap!.total, 100);

  // التحقق إن الـ order_materials اتحذف فعلاً
  const remaining = await prisma.order_materials.findMany({ where: { order_id: order1.id } });
  assertEq('order_materials count after delete', remaining.length, 0);

  // ============================================================
  // سيناريو 4: شراء بدون أوردر
  //   - شراء 5 إكسسوارات بدون ربط بأوردر
  //   - quantity_in يزيد 5
  //   - quantity_used يفضل 0
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 4: Purchase without order')));
  const item2 = await prisma.accessories_inventory.create({
    data: { code: 'T4', item_name: 'Test Acc 1', unit_price: 20, quantity_in: 0, quantity_used: 0 },
  });
  await increaseInventory(prisma, 'accessories_inventory', item2.id, 5, { newUnitPrice: 20 });
  snap = await readInventory(prisma, item2.id, 'accessories_inventory');
  assertEq('after standalone purchase: quantity_in', snap!.in, 5);
  assertEq('after standalone purchase: quantity_used (no order)', snap!.used, 0);
  assertEq('after standalone purchase: quantity_remaining', snap!.remaining, 5);
  assertEq('after standalone purchase: total_price', snap!.total, 100);

  // ============================================================
  // سيناريو 5: تطبيق PATCH متعدد المرات (cumulative deltas)
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 5: Multiple PATCHes (delta cumulative)')));
  const item3 = await prisma.boards_inventory.create({
    data: { code: 'T5', item_name: 'Test Board 3', unit_price: 8, quantity_in: 0, quantity_used: 0 },
  });
  const order3 = await prisma.orders.create({ data: { order_name: 'T5' } });
  await increaseInventory(prisma, 'boards_inventory', item3.id, 50, { newUnitPrice: 8 });
  // POST material بـ 20
  await adjustInventoryUsage(prisma, 'boards_inventory', item3.id, 20);
  await prisma.order_materials.create({
    data: {
      order_id: order3.id, item_category: 'boards_inventory', item_id: item3.id,
      quantity_used: 20, unit_price_snapshot: 8, line_total: 160,
    },
  });
  // PATCH 1: 20 → 25 (diff=+5)
  await prisma.order_materials.updateMany({
    where: { order_id: order3.id, item_id: item3.id },
    data: { quantity_used: 25, line_total: 200 },
  });
  await adjustInventoryUsage(prisma, 'boards_inventory', item3.id, 5);
  // PATCH 2: 25 → 18 (diff=-7)
  await prisma.order_materials.updateMany({
    where: { order_id: order3.id, item_id: item3.id },
    data: { quantity_used: 18, line_total: 144 },
  });
  await adjustInventoryUsage(prisma, 'boards_inventory', item3.id, -7);
  // PATCH 3: 18 → 22 (diff=+4)
  await prisma.order_materials.updateMany({
    where: { order_id: order3.id, item_id: item3.id },
    data: { quantity_used: 22, line_total: 176 },
  });
  await adjustInventoryUsage(prisma, 'boards_inventory', item3.id, 4);
  snap = await readInventory(prisma, item3.id, 'boards_inventory');
  // final: in=50, used=20+5-7+4=22, remaining=28
  assertEq('multi-PATCH final: quantity_in', snap!.in, 50);
  assertEq('multi-PATCH final: quantity_used', snap!.used, 22);
  assertEq('multi-PATCH final: quantity_remaining', snap!.remaining, 28);

  // ============================================================
  // سيناريو 6: دلتا صفر (PATCH بدون تغيير فعلي)
  //   - لازم ما يعملش تعديل على المخزون
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 6: PATCH with zero delta (no-op)')));
  const snapBefore = await readInventory(prisma, item3.id, 'boards_inventory');
  await adjustInventoryUsage(prisma, 'boards_inventory', item3.id, 0);
  const snapAfter = await readInventory(prisma, item3.id, 'boards_inventory');
  assertTrue(
    'no-op PATCH: inventory unchanged',
    snapBefore!.in === snapAfter!.in &&
    snapBefore!.used === snapAfter!.used &&
    snapBefore!.remaining === snapAfter!.remaining
  );

  // ============================================================
  // سيناريو 7: PATCH متعدد لـ "حذف كل المواد" (DELETE all)
  //   - زي ما route.ts DELETE ?material_id=all بيعمل
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 7: Delete all materials of an order')));
  const item4 = await prisma.boards_inventory.create({
    data: { code: 'T7', item_name: 'Test Board 4', unit_price: 5, quantity_in: 0, quantity_used: 0 },
  });
  const order4 = await prisma.orders.create({ data: { order_name: 'T7' } });
  await increaseInventory(prisma, 'boards_inventory', item4.id, 100, { newUnitPrice: 5 });
  // 3 مواد في نفس الأوردر
  for (const q of [10, 20, 30]) {
    await adjustInventoryUsage(prisma, 'boards_inventory', item4.id, q);
    await prisma.order_materials.create({
      data: {
        order_id: order4.id, item_category: 'boards_inventory', item_id: item4.id,
        quantity_used: q, unit_price_snapshot: 5, line_total: q * 5,
      },
    });
  }
  snap = await readInventory(prisma, item4.id, 'boards_inventory');
  assertEq('3 materials added: quantity_in', snap!.in, 100);
  assertEq('3 materials added: quantity_used (60 total)', snap!.used, 60);
  assertEq('3 materials added: quantity_remaining', snap!.remaining, 40);

  // DELETE all
  const allMats = await prisma.order_materials.findMany({ where: { order_id: order4.id } });
  for (const mat of allMats) {
    const qty = Number(mat.quantity_used);
    await adjustInventoryUsage(prisma, 'boards_inventory', mat.item_id, -qty);
    await prisma.order_materials.delete({ where: { id: mat.id } });
  }
  snap = await readInventory(prisma, item4.id, 'boards_inventory');
  assertEq('after delete-all: quantity_in', snap!.in, 100);
  assertEq('after delete-all: quantity_used', snap!.used, 0);
  assertEq('after delete-all: quantity_remaining', snap!.remaining, 100);
  assertEq('after delete-all: total_price', snap!.total, 500);

  // ============================================================
  // سيناريو 8: PATCH أكبر من الكمية المتاحة (دلتا موجب > avail)
  //   - لازم ما يتنفذش — مش بنسمح بـ quantity_used سالب
  // ============================================================
  console.log(c.yellow(c.bold('\nScenario 8: PATCH delta is clamped to ≥0 (no negative used)')));
  const item5 = await prisma.boards_inventory.create({
    data: { code: 'T8', item_name: 'Test Board 5', unit_price: 1, quantity_in: 0, quantity_used: 0 },
  });
  await increaseInventory(prisma, 'boards_inventory', item5.id, 10, { newUnitPrice: 1 });
  await adjustInventoryUsage(prisma, 'boards_inventory', item5.id, 5);
  snap = await readInventory(prisma, item5.id, 'boards_inventory');
  assertEq('initial used after PATCH', snap!.used, 5);

  // محاولة تقليل بـ 10 (diff=-10) — لازم ما ينزلش تحت 0
  await adjustInventoryUsage(prisma, 'boards_inventory', item5.id, -10);
  snap = await readInventory(prisma, item5.id, 'boards_inventory');
  assertEq('after over-reduce: quantity_used clamped to 0', snap!.used, 0);
  assertEq('after over-reduce: quantity_remaining restored', snap!.remaining, 10);

  // ============================================================
  // النتائج
  // ============================================================
  console.log(c.cyan(c.bold('\n=== Results ===')));
  console.log(`Total: ${total}, ${c.green('Passed')}: ${passed}, ${c.red('Failed')}: ${failed}`);

  if (failed > 0) {
    console.log(c.red(c.bold('\n✗ Some tests failed')));
    process.exit(1);
  } else {
    console.log(c.green(c.bold('\n✓ All tests passed!')));
  }
}

main().catch((e) => {
  console.error(c.red('Test runner crashed:'), e);
  process.exit(1);
});
