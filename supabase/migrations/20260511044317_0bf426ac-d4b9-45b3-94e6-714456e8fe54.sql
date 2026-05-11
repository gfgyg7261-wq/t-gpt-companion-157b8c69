
REVOKE EXECUTE ON FUNCTION public.spend_credit(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reset_credits_if_needed(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
