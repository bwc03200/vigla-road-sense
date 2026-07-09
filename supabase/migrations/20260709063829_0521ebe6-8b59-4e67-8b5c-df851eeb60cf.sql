
-- =========================
-- emergency_contacts
-- =========================
CREATE TABLE public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own emergency contacts"
  ON public.emergency_contacts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================
-- convoys
-- =========================
CREATE TABLE public.convoys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convoys TO authenticated;
GRANT ALL ON public.convoys TO service_role;
ALTER TABLE public.convoys ENABLE ROW LEVEL SECURITY;

-- =========================
-- convoy_members
-- =========================
CREATE TABLE public.convoy_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoy_id uuid NOT NULL REFERENCES public.convoys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_lat double precision,
  last_lng double precision,
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convoy_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convoy_members TO authenticated;
GRANT ALL ON public.convoy_members TO service_role;
ALTER TABLE public.convoy_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helper to avoid recursive RLS on convoy_members.
CREATE OR REPLACE FUNCTION public.is_convoy_member(_convoy uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.convoy_members
    WHERE convoy_id = _convoy AND user_id = _user
  );
$$;

-- convoys policies
CREATE POLICY "Members view their convoys"
  ON public.convoys FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.is_convoy_member(id, auth.uid()));
CREATE POLICY "Users create convoys they own"
  ON public.convoys FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates convoy"
  ON public.convoys FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes convoy"
  ON public.convoys FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- convoy_members policies
CREATE POLICY "Members view co-members"
  ON public.convoy_members FOR SELECT
  TO authenticated
  USING (public.is_convoy_member(convoy_id, auth.uid()));
CREATE POLICY "Users join as themselves"
  ON public.convoy_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own membership"
  ON public.convoy_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave own membership"
  ON public.convoy_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =========================
-- convoy_alerts
-- =========================
CREATE TABLE public.convoy_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convoy_id uuid NOT NULL REFERENCES public.convoys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 seconds')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convoy_alerts TO authenticated;
GRANT ALL ON public.convoy_alerts TO service_role;
ALTER TABLE public.convoy_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view active convoy alerts"
  ON public.convoy_alerts FOR SELECT
  TO authenticated
  USING (public.is_convoy_member(convoy_id, auth.uid()) AND expires_at > now());
CREATE POLICY "Members post convoy alerts"
  ON public.convoy_alerts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_convoy_member(convoy_id, auth.uid()));

-- =========================
-- roadbooks
-- =========================
CREATE TABLE public.roadbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  duration_days integer,
  distance_km numeric,
  route_geojson jsonb,
  cover_hint text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadbooks TO authenticated;
GRANT ALL ON public.roadbooks TO service_role;
ALTER TABLE public.roadbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roadbooks: public or own visible"
  ON public.roadbooks FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Roadbooks: creator inserts"
  ON public.roadbooks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Roadbooks: creator updates"
  ON public.roadbooks FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Roadbooks: creator deletes"
  ON public.roadbooks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =========================
-- Realtime
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.convoy_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.convoy_alerts;

-- Indexes
CREATE INDEX idx_convoy_members_convoy ON public.convoy_members(convoy_id);
CREATE INDEX idx_convoy_alerts_convoy ON public.convoy_alerts(convoy_id, expires_at);
CREATE INDEX idx_emergency_contacts_user ON public.emergency_contacts(user_id);
CREATE INDEX idx_roadbooks_public ON public.roadbooks(is_public) WHERE is_public = true;
