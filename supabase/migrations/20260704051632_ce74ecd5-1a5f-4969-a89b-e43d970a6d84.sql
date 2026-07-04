
CREATE TYPE public.hazard_type AS ENUM ('radar_fixe','radar_mobile','accident','travaux','obstacle','ralentissement');

CREATE TABLE public.hazard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.hazard_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 1,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  denied_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours')
);

GRANT SELECT ON public.hazard_reports TO anon;
GRANT SELECT, INSERT, UPDATE ON public.hazard_reports TO authenticated;
GRANT ALL ON public.hazard_reports TO service_role;

ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hazards"
  ON public.hazard_reports FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Authenticated users can create hazards"
  ON public.hazard_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Authenticated users can confirm or deny hazards"
  ON public.hazard_reports FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_hazard_reports_expires ON public.hazard_reports(expires_at);
CREATE INDEX idx_hazard_reports_location ON public.hazard_reports(latitude, longitude);

ALTER PUBLICATION supabase_realtime ADD TABLE public.hazard_reports;
ALTER TABLE public.hazard_reports REPLICA IDENTITY FULL;

CREATE TABLE public.trip_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  distance_km REAL NOT NULL DEFAULT 0,
  alerts_received INTEGER NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_history TO authenticated;
GRANT ALL ON public.trip_history TO service_role;

ALTER TABLE public.trip_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trips (select)"
  ON public.trip_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own trips (insert)"
  ON public.trip_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own trips (update)"
  ON public.trip_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own trips (delete)"
  ON public.trip_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
