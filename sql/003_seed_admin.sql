-- 003_seed_admin.sql
-- ينشئ حساب الأدمن الرئيسي باستخدام pgcrypto من schema extensions

set search_path to mazaya, public, auth, extensions;

do $$
declare
  v_user_id  uuid;
  v_email    constant text := 'backupapps1998@gmail.com';
  v_password constant text := '123456';
  v_hash     text;
begin
  -- 1. ابحث عن المستخدم لو موجود
  select id into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  -- 2. ولّد الهاش من extensions.pgcrypto
  v_hash := extensions.crypt(v_password, extensions.gen_salt('bf'));

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_hash,
      now(),
      jsonb_build_object('provider','email','providers', array['email']),
      jsonb_build_object('name','Backup Admin'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.users
       set encrypted_password = v_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     where id = v_user_id;
  end if;

  insert into mazaya.profiles (id, name, email, role, branch_id)
  values (v_user_id, 'Backup Admin', v_email, 'admin', null)
  on conflict (id) do update
    set name      = excluded.name,
        email     = excluded.email,
        role      = 'admin',
        branch_id = null;
end $$;

-- 3. صف صلاحيات افتراضي للمدير
insert into mazaya.admin_permissions (
  user_id, perm_dashboard, perm_orders, perm_journal, perm_reports,
  perm_inventory, perm_suppliers, perm_customers, perm_branches,
  perm_contractors, perm_overhead, perm_admin_users, perm_material_types
)
select id, true, true, true, true, true, true, true, true, true, true, true, true
from mazaya.profiles
where email = 'backupapps1998@gmail.com'
on conflict (user_id) do nothing;

-- 4. فحص النتيجة
select id, name, email, role, branch_id
from mazaya.profiles
where email = 'backupapps1998@gmail.com';
