-- Seed Data with initial admin user
-- Default admin password: admin123 (تغييرها بعد أول تسجيل دخول)

SET search_path TO mazaya;

-- Suppliers
INSERT INTO mazaya.suppliers (name, payment_type, phone, notes) VALUES
  ('شركة النيل للأثاث', 'transfer', '0123456789', 'مورد ألواح رئيسي'),
  ('شركة الدلتا الخشبية', 'cash', '0987654321', 'متخصصة في MDF'),
  ('شركة البحر الأبيض', 'both', '0111122223', 'موردة اكسسوارات'),
  ('مصنع الزهراء', 'transfer', '0222233334', 'ألوميتال والتنجيد'),
  ('شركة الشرقية', 'both', '0333344445', 'خامات متعددة'),
  ('موردون الفردوس', 'cash', '0444455556', 'متخصصون في الكاوتش'),
  ('شركة البناء والتشييد', 'transfer', '0555566667', 'موردة عامة')
ON CONFLICT DO NOTHING;

-- Branches
INSERT INTO mazaya.branches (name, location, phone, notes) VALUES
  ('معرض دمياط الرئيسي', 'دمياط - الميناء', '0123123123', 'المقر الرئيسي'),
  ('معرض القاهرة', 'القاهرة - النيل', '0111111111', 'فرع العاصمة'),
  ('معرض الإسكندرية', 'الإسكندرية - أمام البحر', '0222222222', 'فرع ساحلي'),
  ('معرض الجيزة', 'الجيزة - الهرم', '0333333333', 'فرع الجيزة')
ON CONFLICT DO NOTHING;

-- Admin user (password: admin123 - bcrypt hash)
INSERT INTO mazaya.users (email, password_hash, name, role) VALUES
  ('abomrzk@gmail.com', '$2a$10$OqRNT2xxgiYk0WDSfYZcmu2Edlx5Y6F0/KNp6eeCjWRIbfkgvwdf.', 'محمد مدير المصنع', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Admin permissions for user id=1
INSERT INTO mazaya.admin_permissions (user_id) VALUES (1)
ON CONFLICT DO NOTHING;

-- Contractors
INSERT INTO mazaya.contractors (name, type, phone, notes) VALUES
  ('ورشة ألوميتال الإسلامي', 'aluminium', '0100000010', 'متخصصة في الأبواب'),
  ('ورشة التنجيد الأسود', 'upholstery', '0100000011', 'تنجيد عالي الجودة'),
  ('ورشة النقل السريع', 'other', '0100000012', 'نقل وتسليم')
ON CONFLICT DO NOTHING;

-- Material Types
INSERT INTO mazaya.material_types (name) VALUES
  ('MDF (عادي/ساده)'), ('MDF أخضر'), ('MDF مطلي / مكثف'),
  ('كونتر ساده'), ('كونتر مونيدج'), ('بيروديوم'), ('سندوتش')
ON CONFLICT DO NOTHING;

-- Accessory Types
INSERT INTO mazaya.accessory_types (name) VALUES
  ('مفصلات - بلوم (Blum)'), ('مفصلات - عادي'), ('سكك دُرج'),
  ('مجاري دُرج'), ('جوانب / قواعد'), ('كاوتش'), ('أخرى')
ON CONFLICT DO NOTHING;

-- Lookup Lists
INSERT INTO mazaya.lookup_lists (list_key, value, sort_order) VALUES
  ('board_material', 'MDF (عادي/ساده)', 1),
  ('board_material', 'MDF أخضر', 2),
  ('board_material', 'MDF مطلي / مكثف', 3),
  ('board_material', 'كونتر ساده', 4),
  ('board_material', 'كونتر مونيدج', 5),
  ('board_material', 'بيروديوم', 6),
  ('board_material', 'سندوتش', 7),
  ('accessory_type', 'مفصلات - بلوم (Blum)', 1),
  ('accessory_type', 'مفصلات - عادي', 2),
  ('accessory_type', 'سكك دُرج', 3),
  ('accessory_type', 'مجاري دُرج', 4),
  ('accessory_type', 'جوانب / قواعد', 5),
  ('accessory_type', 'كاوتش', 6),
  ('accessory_type', 'أخرى', 99),
  ('payment_type', 'نقدي', 1),
  ('payment_type', 'تحويل', 2),
  ('payment_type', 'كلاهما', 3),
  ('order_type', 'تصنيع جديد', 1),
  ('order_type', 'صيانة', 2),
  ('order_status', 'مفتوح', 1),
  ('order_status', 'قيد التنفيذ', 2),
  ('order_status', 'مكتمل', 3),
  ('order_status', 'تم التسليم', 4),
  ('journal_entry_type', 'مشتريات', 1),
  ('journal_entry_type', 'دفعة واردة من معرض', 2),
  ('journal_entry_type', 'دفعة صادرة لمورد', 3),
  ('journal_entry_type', 'تحويل تمريري', 4),
  ('journal_entry_type', 'نثريات', 5),
  ('payment_method', 'نقدي', 1),
  ('payment_method', 'تحويل', 2),
  ('external_work_type', 'ألوميتال', 1),
  ('external_work_type', 'تنجيد', 2),
  ('external_work_type', 'أخرى', 3)
ON CONFLICT (list_key, value) DO NOTHING;
