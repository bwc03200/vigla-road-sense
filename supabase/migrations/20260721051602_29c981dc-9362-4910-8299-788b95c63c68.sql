
-- Enable required extensions for scheduled HTTP jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store the function endpoint + call key in Vault (idempotent).
-- The publishable/anon key is safe to store here; verify_jwt is off for
-- the target function so no service_role key is ever needed.
DO $$
DECLARE
  v_url text := 'https://ssomnhvzmzqvhlfqjqug.supabase.co/functions/v1/import-official-radars';
  v_key text := 'sb_publishable_kVkED95h847rmrZAt9zsFQ_pW0hJLBB';
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'official_radars_function_url') THEN
    UPDATE vault.secrets SET secret = v_url WHERE name = 'official_radars_function_url';
  ELSE
    PERFORM vault.create_secret(v_url, 'official_radars_function_url');
  END IF;

  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'official_radars_function_key') THEN
    UPDATE vault.secrets SET secret = v_key WHERE name = 'official_radars_function_key';
  ELSE
    PERFORM vault.create_secret(v_key, 'official_radars_function_key');
  END IF;
END $$;

-- Idempotent schedule: drop existing job with same name if any
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-official-radars-import') THEN
    PERFORM cron.unschedule('weekly-official-radars-import');
  END IF;
END $$;

SELECT cron.schedule(
  'weekly-official-radars-import',
  '0 4 * * 1',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'official_radars_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'official_radars_function_key'),
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'official_radars_function_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);
