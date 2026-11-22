-- Reverses LEANS-CAP-up.sql: lean_projection returns every Lean on a carded fixture again.
begin;
do $$
declare fn oid;def text;cnt int;
 new_txt constant text=$o$'leans',(select coalesce(jsonb_agg(jsonb_build_object('f',l.fxid,'c',l.code,'q',round(l.prob,4),'m',l.market) order by l.fxid),'[]'::jsonb) from public.lean_picks l where l.fxid in(select fxid from ids)),$o$;
 old_txt constant text=$n$'leans',(select coalesce(jsonb_agg(jsonb_build_object('f',k.fxid,'c',k.code,'q',round(k.prob,4),'m',k.market) order by k.fxid),'[]'::jsonb) from (select l.fxid,l.code,l.prob,l.market from public.lean_picks l where l.fxid in(select fxid from ids) order by (l.kickoff<(statement_timestamp() at time zone 'UTC')::date),abs(l.kickoff-(statement_timestamp() at time zone 'UTC')::date),l.fxid limit 1500) k),$n$;
begin
 fn=to_regprocedure('mm_fixture_delivery.lean_projection(jsonb)');
 def=pg_get_functiondef(fn);
 cnt=(length(def)-length(replace(def,old_txt,'')))/length(old_txt);if cnt<>1 then raise exception 'Expected the capped leans list once, found %',cnt;end if;
 execute replace(def,old_txt,new_txt);
 if (select proowner::regrole::text from pg_proc where oid=fn)<>'postgres' then raise exception 'lean_projection owner changed';end if;
end $$;
commit;
