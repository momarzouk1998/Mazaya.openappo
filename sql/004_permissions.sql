-- 004_permissions.sql
-- جدول صلاحيات المديرين
set search_path to mazaya, public;

drop table if exists mazaya.admin_permissions cascade;

create table mazaya.admin_permissions (
  user_id uuid primary key references mazaya.profiles(id) on delete cascade,

  perm_dashboard      boolean not null default true,
  perm_orders         boolean not null default true,
  perm_journal        boolean not null default true,
  perm_reports        boolean not null default true,
  perm_inventory      boolean not null default true,
  perm_suppliers      boolean not null default true,
  perm_customers      boolean not null default true,
  perm_branches       boolean not null default true,
  perm_contractors    boolean not null default true,
  perm_overhead       boolean not null default true,
  perm_admin_users    boolean not null default true,
  perm_material_types boolean not null default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table mazaya.admin_permissions enable row level security;

drop policy if exists "Admin full access"     on mazaya.admin_permissions;
drop policy if exists "Users view own permissions" on mazaya.admin_permissions;

create policy "Admin full access"
  on mazaya.admin_permissions for all
  using      (mazaya.is_admin())
  with check (mazaya.is_admin());

create policy "Users view own permissions"
  on mazaya.admin_permissions for select
  using (auth.uid() = user_id);

-- trigger for updated_at
create or replace function mazaya.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_admin_permissions on mazaya.admin_permissions;
create trigger trg_touch_admin_permissions
  before update on mazaya.admin_permissions
  for each row execute function mazaya.touch_updated_at();

-- helper function: خريطة الصلاحيات للمستخدم الحالي
create or replace function mazaya.get_my_permissions()
returns jsonb
language sql
stable
security definer
set search_path = mazaya, public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'dashboard',      perm_dashboard,
        'orders',         perm_orders,
        'journal',        perm_journal,
        'reports',        perm_reports,
        'inventory',      perm_inventory,
        'suppliers',      perm_suppliers,
        'customers',      perm_customers,
        'branches',       perm_branches,
        'contractors',    perm_contractors,
        'overhead',       perm_overhead,
        'admin_users',    perm_admin_users,
        'material_types', perm_material_types
      )
      from mazaya.admin_permissions
      where user_id = auth.uid()
    ),
    jsonb_build_object(
      'dashboard', true, 'orders', true, 'journal', true, 'reports', true,
      'inventory', true, 'suppliers', true, 'customers', true, 'branches', true,
      'contractors', true, 'overhead', true, 'admin_users', true, 'material_types', true
    )
  );
$$;

grant execute on function mazaya.get_my_permissions() to authenticated;
