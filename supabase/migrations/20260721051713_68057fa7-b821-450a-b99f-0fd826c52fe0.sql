
CREATE TABLE IF NOT EXISTS public.hazard_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id uuid NOT NULL REFERENCES public.hazard_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('confirm','deny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hazard_votes_unique_user UNIQUE (hazard_id, user_id)
);

GRANT SELECT ON public.hazard_votes TO authenticated;
GRANT ALL ON public.hazard_votes TO service_role;

ALTER TABLE public.hazard_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own votes" ON public.hazard_votes;
CREATE POLICY "Users read own votes" ON public.hazard_votes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS hazard_votes_hazard_idx ON public.hazard_votes(hazard_id);

CREATE OR REPLACE FUNCTION public.confirm_hazard(hazard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hazard uuid := hazard_id;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.hazard_votes (hazard_id, user_id, vote_type)
  VALUES (v_hazard, v_user, 'confirm')
  ON CONFLICT (hazard_id, user_id) DO UPDATE SET vote_type = EXCLUDED.vote_type;

  UPDATE public.hazard_reports SET
    confirmed_count = (SELECT count(*) FROM public.hazard_votes v WHERE v.hazard_id = v_hazard AND v.vote_type = 'confirm'),
    denied_count    = (SELECT count(*) FROM public.hazard_votes v WHERE v.hazard_id = v_hazard AND v.vote_type = 'deny')
  WHERE id = v_hazard AND expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_hazard(hazard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_hazard uuid := hazard_id;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.hazard_votes (hazard_id, user_id, vote_type)
  VALUES (v_hazard, v_user, 'deny')
  ON CONFLICT (hazard_id, user_id) DO UPDATE SET vote_type = EXCLUDED.vote_type;

  UPDATE public.hazard_reports SET
    confirmed_count = (SELECT count(*) FROM public.hazard_votes v WHERE v.hazard_id = v_hazard AND v.vote_type = 'confirm'),
    denied_count    = (SELECT count(*) FROM public.hazard_votes v WHERE v.hazard_id = v_hazard AND v.vote_type = 'deny')
  WHERE id = v_hazard AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_hazard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deny_hazard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_hazard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_hazard(uuid) TO authenticated;
