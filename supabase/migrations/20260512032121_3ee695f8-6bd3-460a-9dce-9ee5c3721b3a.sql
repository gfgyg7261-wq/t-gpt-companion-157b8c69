
-- 1. Attach missing trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles, credits, roles for any existing auth users that are missing them
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.credits (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.credits c ON c.user_id = u.id
WHERE c.user_id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;

-- 3. Create admin account if missing
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin2024@gmail.com';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin2024@gmail.com', crypt('jabir551233', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('display_name','Admin'),
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', 'admin2024@gmail.com', 'email_verified', true),
      'email', v_uid::text, now(), now(), now());
  END IF;

  -- Ensure profile, credits, admin role exist
  INSERT INTO public.profiles (id, display_name) VALUES (v_uid, 'Admin') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.credits (user_id, balance) VALUES (v_uid, 9999) ON CONFLICT (user_id) DO UPDATE SET balance = 9999;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin') ON CONFLICT DO NOTHING;
END $$;

-- 4. Helper view for admins to see users with email + last sign-in (passwords are hashed, never visible)
CREATE OR REPLACE VIEW public.admin_users_view
WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.email,
  u.last_sign_in_at,
  u.created_at,
  COALESCE(p.display_name, split_part(u.email,'@',1)) AS display_name,
  COALESCE(c.balance, 0) AS credit_balance,
  EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.credits c ON c.user_id = u.id;

-- Grant select only to authenticated; RLS on underlying tables blocks non-admins from credits/profiles of others
GRANT SELECT ON public.admin_users_view TO authenticated;

-- Function to safely list users for admins (bypasses join issues)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid, email text, display_name text,
  credit_balance int, is_admin boolean,
  last_sign_in_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text,
    COALESCE(p.display_name, split_part(u.email,'@',1)),
    COALESCE(c.balance, 0)::int,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'),
    u.last_sign_in_at, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.credits c ON c.user_id = u.id
  ORDER BY u.created_at DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
