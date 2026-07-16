
DROP POLICY IF EXISTS "Authenticated users can confirm or deny active hazards" ON public.hazard_reports;
REVOKE UPDATE ON public.hazard_reports FROM authenticated;

CREATE OR REPLACE FUNCTION public.confirm_hazard(hazard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.hazard_reports
    SET confirmed_count = confirmed_count + 1
    WHERE id = hazard_id AND expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_hazard(hazard_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.hazard_reports
    SET denied_count = denied_count + 1
    WHERE id = hazard_id AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_hazard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deny_hazard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_hazard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_hazard(uuid) TO authenticated;
