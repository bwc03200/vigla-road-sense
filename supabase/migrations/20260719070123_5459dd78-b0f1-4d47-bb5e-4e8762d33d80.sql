GRANT SELECT ON public.official_radars TO anon, authenticated;
GRANT ALL ON public.official_radars TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;