
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Credits
CREATE TABLE public.credits (
  user_id uuid PRIMARY KEY,
  balance int NOT NULL DEFAULT 5,
  last_reset date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own credits" ON public.credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all credits" ON public.credits FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage credits" ON public.credits FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reset & spend functions
CREATE OR REPLACE FUNCTION public.reset_credits_if_needed(_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal int;
BEGIN
  INSERT INTO public.credits (user_id, balance, last_reset)
  VALUES (_user_id, 5, (now() AT TIME ZONE 'utc')::date)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.credits
     SET balance = 5, last_reset = (now() AT TIME ZONE 'utc')::date, updated_at = now()
   WHERE user_id = _user_id
     AND last_reset < (now() AT TIME ZONE 'utc')::date;

  SELECT balance INTO _bal FROM public.credits WHERE user_id = _user_id;
  RETURN COALESCE(_bal,0);
END; $$;

CREATE OR REPLACE FUNCTION public.spend_credit(_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal int;
BEGIN
  PERFORM public.reset_credits_if_needed(_user_id);
  UPDATE public.credits SET balance = balance - 1, updated_at = now()
   WHERE user_id = _user_id AND balance > 0
   RETURNING balance INTO _bal;
  RETURN COALESCE(_bal,-1);
END; $$;

-- New user trigger: profile already, now also credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.credits (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Builder threads & messages
CREATE TABLE public.builder_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New site',
  html text NOT NULL DEFAULT '',
  css  text NOT NULL DEFAULT '',
  js   text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.builder_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own builder threads" ON public.builder_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins all builder threads" ON public.builder_threads FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.builder_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.builder_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.builder_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own builder messages" ON public.builder_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins all builder messages" ON public.builder_messages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Admin can view/edit chat threads + messages + profiles
CREATE POLICY "admins all threads" ON public.threads FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins all messages" ON public.messages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins all profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
