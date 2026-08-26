CREATE TABLE public.saved_trips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_name text NOT NULL,
  start_lat double precision NOT NULL,
  start_lng double precision NOT NULL,
  end_name text NOT NULL,
  end_lat double precision NOT NULL,
  end_lng double precision NOT NULL,
  waypoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  distance_m double precision NOT NULL DEFAULT 0,
  duration_s double precision NOT NULL DEFAULT 0,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_trips TO authenticated;
GRANT ALL ON public.saved_trips TO service_role;

ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved trips"
ON public.saved_trips FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX saved_trips_user_created_idx ON public.saved_trips (user_id, created_at DESC);

CREATE TRIGGER update_saved_trips_updated_at
BEFORE UPDATE ON public.saved_trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();