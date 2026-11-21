-- PRODUCTION (toqfdrcjzwnlydqekude). Reverses MATCH-CONTEXT-up.sql. One transaction.
-- ORDER: publish a client that no longer calls matchmind_match_context_v1 first, or accept that the
-- detail panels fall back to their "unavailable" notes (the client treats a failed call as no context).
begin;
do $$begin
 if to_regprocedure('public.matchmind_match_context_v1(bigint)') is null then raise exception 'MATCH-CONTEXT-up.sql is not installed';end if;
 if not pg_catalog.pg_has_role(current_user,'mm_match_context','USAGE') then
  execute format('grant mm_match_context to %I with set true, inherit true',current_user);
 end if;
end$$;
drop function public.matchmind_match_context_v1(bigint);
drop policy match_context_read on public.fixtures;
revoke select(fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,ht_h,ht_a,events,lineup_h,lineup_a) on public.fixtures from mm_match_context;
revoke usage on schema public from mm_match_context;
do $$begin execute format('revoke mm_match_context from %I',current_user);exception when others then null;end$$;
drop role mm_match_context;
notify pgrst,'reload schema';
commit;
