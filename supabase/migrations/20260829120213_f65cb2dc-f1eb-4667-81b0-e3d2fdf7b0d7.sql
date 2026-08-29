REVOKE EXECUTE ON FUNCTION public.insight_divisao_no_escopo(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.insight_divisao_no_escopo(uuid) TO authenticated, service_role;