
REVOKE ALL ON FUNCTION public.is_convoy_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_convoy_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_convoy_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_convoy_member(uuid, uuid) TO service_role;
