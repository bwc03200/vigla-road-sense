
DROP POLICY "Authenticated users can confirm or deny hazards" ON public.hazard_reports;
CREATE POLICY "Authenticated users can confirm or deny active hazards"
  ON public.hazard_reports FOR UPDATE
  TO authenticated
  USING (expires_at > now())
  WITH CHECK (expires_at > now());
