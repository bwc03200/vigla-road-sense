CREATE TABLE public.trip_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  distance_km real NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  avg_speed real NOT NULL DEFAULT 0,
  hazards_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_summaries TO authenticated;
GRANT ALL ON public.trip_summaries TO service_role;

ALTER TABLE public.trip_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own trip summaries" ON public.trip_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trip summaries" ON public.trip_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own trip summaries" ON public.trip_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_trip_summaries_user_created ON public.trip_summaries (user_id, created_at DESC);