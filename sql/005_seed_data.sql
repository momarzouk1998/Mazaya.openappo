-- 005_seed_data.sql
-- بيانات تجريبية شاملة للنظام
-- متوافق مع schema الفعلي
-- ملاحظة: تأكد من تشغيل 006_fix_columns.sql أولاً إذا كان الجدول موجود قديماً

set search_path to mazaya, public;

-- 0. تنظيف البيانات التشغيلية
truncate table mazaya.order_external_work  restart identity cascade;
truncate table mazaya.order_materials      restart identity cascade;
truncate table mazaya.journal_entries      restart identity cascade;
truncate table mazaya.overhead_expenses    restart identity cascade;
truncate table mazaya.orders               restart identity cascade;
truncate table mazaya.boards_inventory     restart identity cascade;
truncate table mazaya.accessories_inventory restart identity cascade;
truncate table mazaya.customers            restart identity cascade;
truncate table mazaya.contractors          restart identity cascade;
truncate table mazaya.suppliers            restart identity cascade;
truncate table mazaya.branches             restart identity cascade;
truncate table mazaya.material_types       restart identity cascade;
truncate table mazaya.accessory_types      restart identity cascade;
-- جدول البروفايلات والصلاحيات آمن

-- 1. أنواع الخامات
insert into mazaya.material_types (name) values
  ('MDF عادي/ساده'),
  ('MDF أخضر'),
  ('MDF مطلي / مكثف'),
  ('كونتر ساده'),
  ('كونتر مونيدج'),
  ('بيروديوم'),
  ('سندوتش')
on conflict (name) do nothing;

-- 2. أنواع الإكسسوارات
insert into mazaya.accessory_types (name) values
  ('مفصلات - بلوم (Blum)'),
  ('مفصلات - عادي'),
  ('سكك دُرج'),
  ('مجاري دُرج'),
  ('جوانب / قواعد'),
  ('كاوتش (مطاطات)'),
  ('أخرى')
on conflict (name) do nothing;

-- 3. الفروع
insert into mazaya.branches (id, name, location, phone) values
  ('11111111-1111-1111-1111-111111111111', 'معرض دمياط',       'دمياط - شارع الكورنيش',   '057-222-1001'),
  ('22222222-2222-2222-2222-222222222222', 'معرض القاهرة',     'القاهرة - مدينة نصر',       '02-244-22002'),
  ('33333333-3333-3333-3333-333333333333', 'معرض الإسكندرية',  'الإسكندرية - سموحة',       '03-422-33003'),
  ('44444444-4444-4444-4444-444444444444', 'معرض المنصورة',    'المنصورة - شارع الجمهورية', '050-233-44004')
on conflict (id) do nothing;

-- 4. الموردين
insert into mazaya.suppliers (id, name, payment_type, phone, notes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'مورد الألواح الذهبي',   'تحويل',  '0100-111-1001', 'مورد رئيسي للألواح'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'مؤسسة الإكسسوارات',      'نقدي',   '0100-222-2002', 'إكسسوارات متنوعة'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'الشركة المصرية للأخشاب', 'كلاهما', '0100-333-3003', 'مورد كونتر ومونة'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'مورد الكاوتش',           'نقدي',   '0100-444-4004', ''),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'مورد الحديد',            'تحويل',  '0100-555-5005', '')
on conflict (id) do nothing;

-- 5. العملاء
insert into mazaya.customers (id, name, branch_id, phone, address) values
  ('10000001-0000-0000-0000-000000000001', 'أحمد محمد علي',        '11111111-1111-1111-1111-111111111111', '0100-901-1001', 'دمياط - حي ثان'),
  ('10000002-0000-0000-0000-000000000002', 'محمود السيد إبراهيم',   '11111111-1111-1111-1111-111111111111', '0100-901-1002', 'دمياط - حي أول'),
  ('10000003-0000-0000-0000-000000000003', 'سامي عبد الرحمن',        '22222222-2222-2222-2222-222222222222', '0100-901-1003', 'القاهرة - التجمع'),
  ('10000004-0000-0000-0000-000000000004', 'كريم حسن',              '22222222-2222-2222-2222-222222222222', '0100-901-1004', 'القاهرة - الشروق'),
  ('10000005-0000-0000-0000-000000000005', 'يوسف ناجي',             '33333333-3333-3333-3333-333333333333', '0100-901-1005', 'الإسكندرية - سيدي جابر'),
  ('10000006-0000-0000-0000-000000000006', 'خالد عبد الله',         '44444444-4444-4444-4444-444444444444', '0100-901-1006', 'المنصورة - حي الجامعة'),
  ('10000007-0000-0000-0000-000000000007', 'عمر طارق',              '11111111-1111-1111-1111-111111111111', '0100-901-1007', 'دمياط - راس البر'),
  ('10000008-0000-0000-0000-000000000008', 'حسام مصطفى',            '33333333-3333-3333-3333-333333333333', '0100-901-1008', 'الإسكندرية - المنتزه')
on conflict (id) do nothing;

-- 6. المقاولين
insert into mazaya.contractors (id, name, type, phone) values
  ('c1111111-1111-1111-1111-111111111111', 'ورشة الألوميتال الحديثة', 'ألوميتال', '0111-111-1001'),
  ('c2222222-2222-2222-2222-222222222222', 'مقاول التنجيد أبو خالد',  'تنجيد',    '0111-222-2002'),
  ('c3333333-3333-3333-3333-333333333333', 'ورشة القصارة',             'أخرى',     '0111-333-3003')
on conflict (id) do nothing;

-- 7. مخزون الألواح
insert into mazaya.boards_inventory
  (item_name, material_type, unit, code, supplier_id, unit_price, quantity_in, total_price, quantity_used, quantity_remaining, date_added, notes) values
  ('لوح MDF أبيض 18 مم',     'MDF عادي/ساده',   'لوح', 'BRD-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 850,  120,  102000, 0, 120, current_date - 30, ''),
  ('لوح MDF أخضر 18 مم',     'MDF أخضر',        'لوح', 'BRD-002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1050,  80,   84000, 0,  80, current_date - 28, ''),
  ('لوح كونتر ساده 18 مم',   'كونتر ساده',      'لوح', 'BRD-003', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1450,  60,   87000, 0,  60, current_date - 25, ''),
  ('لوح كونتر مونيدج 18 مم', 'كونتر مونيدج',    'لوح', 'BRD-004', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1750,  40,   70000, 0,  40, current_date - 20, ''),
  ('لوح MDF مطلي أبيض',      'MDF مطلي / مكثف', 'لوح', 'BRD-005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1200,  50,   60000, 0,  50, current_date - 18, ''),
  ('لوح بيروديوم',           'بيروديوم',        'لوح', 'BRD-006', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2200,  25,   55000, 0,  25, current_date - 15, ''),
  ('لوح سندوتش 16 مم',       'سندوتش',          'لوح', 'BRD-007', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 900,   70,   63000, 0,  70, current_date - 10, '')
on conflict (supplier_id, code) do nothing;

-- 8. مخزون الإكسسوارات
insert into mazaya.accessories_inventory
  (item_name, accessory_type, unit, code, supplier_id, unit_price, quantity_in, total_price, quantity_used, quantity_remaining, date_added, notes) values
  ('مفصلة بلوم هيدرو 110 درجة', 'مفصلات - بلوم (Blum)', 'قطعة', 'ACC-001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 95,  200,  19000, 0, 200, current_date - 30, ''),
  ('سكك درج 45 سم',             'سكك دُرج',             'قطعة', 'ACC-002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 220,  60,  13200, 0,  60, current_date - 28, ''),
  ('مجاري درج تلسكوبى 45 سم',   'مجاري دُرج',           'قطعة', 'ACC-003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 350,  45,  15750, 0,  45, current_date - 25, ''),
  ('مفصلة عادي 35 مم',          'مفصلات - عادي',        'قطعة', 'ACC-004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 18,  300,   5400, 0, 300, current_date - 22, ''),
  ('كاوتش باب',                 'كاوتش (مطاطات)',       'قطعة', 'ACC-005', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 8,   150,   1200, 0, 150, current_date - 20, ''),
  ('قاعدة دولاب',                'جوانب / قواعد',        'قطعة', 'ACC-006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 180,  40,   7200, 0,  40, current_date - 15, ''),
  ('مقبض معدن 128 مم',          'أخرى',                 'قطعة', 'ACC-007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 45,  100,   4500, 0, 100, current_date - 12, '')
on conflict (supplier_id, code) do nothing;

-- 9. الأوردرات
insert into mazaya.orders
  (id, order_name, customer_id, branch_id, order_type, start_date, status,
   installation_cost, internal_transport_cost, external_transport_cost, factory_commission, notes) values
  ('a0000001-0000-0000-0000-000000000001', 'مطبخ أحمد محمد - دمياط',  '10000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 25, 'مكتمل',      3000, 500, 800, 4500, ''),
  ('a0000002-0000-0000-0000-000000000002', 'دولاب محمود السيد',       '10000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 20, 'قيد التنفيذ', 2500, 400, 600, 3800, ''),
  ('a0000003-0000-0000-0000-000000000003', 'مطبخ سامي - التجمع',      '10000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'تصنيع جديد', current_date - 18, 'مكتمل',      5000, 700, 1200, 6500, ''),
  ('a0000004-0000-0000-0000-000000000004', 'غرفة نوم كريم',           '10000004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'تصنيع جديد', current_date - 15, 'مفتوح',      4000, 500, 900, 5200, ''),
  ('a0000005-0000-0000-0000-000000000005', 'مكتب يوسف - سيدي جابر',  '10000005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'تصنيع جديد', current_date - 12, 'مكتمل',      3500, 400, 700, 4200, ''),
  ('a0000006-0000-0000-0000-000000000006', 'صيانة خالد - المنصورة',   '10000006-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444444', 'صيانة',     current_date - 10, 'تم التسليم', 1500, 300, 400, 1800, 'صيانة دورية'),
  ('a0000007-0000-0000-0000-000000000007', 'مطبخ عمر - راس البر',     '10000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'تصنيع جديد', current_date - 8,  'قيد التنفيذ', 4500, 600, 1000, 5500, ''),
  ('a0000008-0000-0000-0000-000000000008', 'مكتبة حسام - المنتزه',    '10000008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'تصنيع جديد', current_date - 5,  'مفتوح',      2000, 300, 500, 2500, '')
on conflict (id) do nothing;

-- 10. مواد الأوردرات
insert into mazaya.order_materials
  (order_id, item_category, item_id, quantity_used, unit_price_snapshot) values
  ('a0000001-0000-0000-0000-000000000001', 'board',     (select id from mazaya.boards_inventory     where code='BRD-001' limit 1), 18, 850),
  ('a0000001-0000-0000-0000-000000000001', 'board',     (select id from mazaya.boards_inventory     where code='BRD-005' limit 1), 8, 1200),
  ('a0000001-0000-0000-0000-000000000001', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-001' limit 1), 60, 95),
  ('a0000002-0000-0000-0000-000000000002', 'board',     (select id from mazaya.boards_inventory     where code='BRD-002' limit 1), 10, 1050),
  ('a0000002-0000-0000-0000-000000000002', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-002' limit 1), 12, 220),
  ('a0000003-0000-0000-0000-000000000003', 'board',     (select id from mazaya.boards_inventory     where code='BRD-003' limit 1), 15, 1450),
  ('a0000003-0000-0000-0000-000000000003', 'board',     (select id from mazaya.boards_inventory     where code='BRD-004' limit 1), 6, 1750),
  ('a0000003-0000-0000-0000-000000000003', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-001' limit 1), 80, 95),
  ('a0000003-0000-0000-0000-000000000003', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-003' limit 1), 18, 350),
  ('a0000004-0000-0000-0000-000000000004', 'board',     (select id from mazaya.boards_inventory     where code='BRD-005' limit 1), 4, 1200),
  ('a0000004-0000-0000-0000-000000000004', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-004' limit 1), 50, 18),
  ('a0000005-0000-0000-0000-000000000005', 'board',     (select id from mazaya.boards_inventory     where code='BRD-006' limit 1), 5, 2200),
  ('a0000005-0000-0000-0000-000000000005', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-007' limit 1), 20, 45),
  ('a0000006-0000-0000-0000-000000000006', 'board',     (select id from mazaya.boards_inventory     where code='BRD-007' limit 1), 4, 900),
  ('a0000006-0000-0000-0000-000000000006', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-005' limit 1), 10, 8),
  ('a0000007-0000-0000-0000-000000000007', 'board',     (select id from mazaya.boards_inventory     where code='BRD-001' limit 1), 12, 850),
  ('a0000007-0000-0000-0000-000000000007', 'board',     (select id from mazaya.boards_inventory     where code='BRD-002' limit 1), 6, 1050),
  ('a0000007-0000-0000-0000-000000000007', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-001' limit 1), 40, 95),
  ('a0000008-0000-0000-0000-000000000008', 'board',     (select id from mazaya.boards_inventory     where code='BRD-005' limit 1), 3, 1200),
  ('a0000008-0000-0000-0000-000000000008', 'accessory', (select id from mazaya.accessories_inventory where code='ACC-004' limit 1), 30, 18);

-- 11. الأعمال الخارجية
insert into mazaya.order_external_work (order_id, contractor_id, work_type, amount, notes) values
  ('a0000001-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 2500, 'شبابيك ألوميتال للمطبخ'),
  ('a0000003-0000-0000-0000-000000000003', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 3800, 'واجهة ألوميتال'),
  ('a0000003-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'تنجيد',    1800, 'تنجيد كنبة'),
  ('a0000004-0000-0000-0000-000000000004', 'c3333333-3333-3333-3333-333333333333', 'أخرى',     1200, 'قصارة حوائط'),
  ('a0000007-0000-0000-0000-000000000007', 'c1111111-1111-1111-1111-111111111111', 'ألوميتال', 2200, 'شبابيك ألوميتال');

-- 12. اليومية المالية
insert into mazaya.journal_entries (date, entry_type, description, amount, payment_method, party_id, party_type) values
  (current_date - 30, 'مشتريات',             'شراء ألواح MDF أبيض - مورد الألواح الذهبي', -102000, 'تحويل', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'supplier'),
  (current_date - 28, 'مشتريات',             'شراء ألواح MDF أخضر',                          -84000, 'تحويل', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'supplier'),
  (current_date - 25, 'مشتريات',             'شراء كونتر ساده',                              -87000, 'نقدي',  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'supplier'),
  (current_date - 20, 'مشتريات',             'شراء كونتر مونيدج',                            -70000, 'نقدي',  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'supplier'),
  (current_date - 30, 'مشتريات',             'شراء إكسسوارات متنوعة',                       -19000, 'نقدي',  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'supplier'),
  (current_date - 18, 'دفعة واردة من معرض',  'دفعة من العميل أحمد محمد',                     25000,  'نقدي',  '10000001-0000-0000-0000-000000000001', null),
  (current_date - 16, 'دفعة واردة من معرض',  'دفعة من العميل سامي عبد الرحمن',               40000,  'تحويل', '10000003-0000-0000-0000-000000000003', null),
  (current_date - 10, 'دفعة واردة من معرض',  'دفعة من العميل يوسف ناجي',                    18000,  'نقدي',  '10000005-0000-0000-0000-000000000005', null),
  (current_date - 6,  'دفعة واردة من معرض',  'دفعة من العميل عمر طارق',                     15000,  'نقدي',  '10000007-0000-0000-0000-000000000007', null),
  (current_date - 15, 'نثريات',              'رواتب العمال - نصف الشهر',                    -45000, 'تحويل', null, null),
  (current_date - 1,  'نثريات',              'رواتب العمال - نهاية الشهر',                  -45000, 'تحويل', null, null),
  (current_date - 12, 'نثريات',              'فاتورة كهرباء المصنع',                        -3500,  'نقدي',  null, null),
  (current_date - 8,  'نثريات',              'فاتورة مياه',                                  -800,   'نقدي',  null, null),
  (current_date - 5,  'نثريات',              'صيانة ماكينة',                                -2200,  'نقدي',  null, null),
  (current_date - 3,  'نثريات',              'انتقالات ووقود',                              -1500,  'نقدي',  null, null);

-- 13. النثريات
insert into mazaya.overhead_expenses (date, description, amount, notes) values
  (current_date - 12, 'فاتورة كهرباء المصنع', 3500,  ''),
  (current_date - 8,  'فاتورة مياه',           800,   ''),
  (current_date - 5,  'صيانة ماكينة',         2200,  ''),
  (current_date - 3,  'انتقالات ووقود',       1500,  ''),
  (current_date - 15, 'رواتب - نصف الشهر',   45000,  'شامل كل الأقسام'),
  (current_date - 1,  'رواتب - نهاية الشهر', 45000,  'شامل كل الأقسام');

-- 14. فحص
select 'فروع' as نوع, count(*) as العدد from mazaya.branches
union all select 'موردين',     count(*) from mazaya.suppliers
union all select 'عملاء',      count(*) from mazaya.customers
union all select 'ألواح',      count(*) from mazaya.boards_inventory
union all select 'إكسسوارات',  count(*) from mazaya.accessories_inventory
union all select 'أوردرات',    count(*) from mazaya.orders
union all select 'مواد أوردر', count(*) from mazaya.order_materials
union all select 'يومية',      count(*) from mazaya.journal_entries
union all select 'نثريات',     count(*) from mazaya.overhead_expenses;
