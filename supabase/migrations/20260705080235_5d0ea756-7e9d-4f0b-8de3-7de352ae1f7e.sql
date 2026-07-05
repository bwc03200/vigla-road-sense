CREATE TABLE public.official_radars (
  id text PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  type text,
  route text,
  vitesse_controlee integer,
  date_installation date,
  source text NOT NULL DEFAULT 'data.gouv.fr',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.official_radars TO anon, authenticated;
GRANT ALL ON public.official_radars TO service_role;

ALTER TABLE public.official_radars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view official radars"
  ON public.official_radars FOR SELECT
  USING (true);

CREATE INDEX official_radars_lat_lng_idx ON public.official_radars (latitude, longitude);