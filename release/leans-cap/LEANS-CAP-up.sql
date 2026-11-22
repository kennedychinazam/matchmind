-- PRODUCTION (toqfdrcjzwnlydqekude). Build 368: the edition's Lean list can never stop an edition.
-- payload_valid admits at most 1500 `leans`, and lean_projection returned every Lean on a carded fixture
-- with no bound, so a busy window could fail payload_valid and materialize would write no edition at all.
-- lean_projection now returns at most 1500: fixtures from today forward first (nearest kick-off first), then
-- past ones (most recent first). lean_record is still computed over every Lean, so the record is unchanged.
-- Issued Leans (public.lean_picks) are not touched. Measured before: 170 Leans in total.
-- Pattern of release/production-cutover/LOGOS-up.sql: one exact-once text replacement, owner and grants checked.
-- lean_projection is owned by postgres; materialize (mm_display_materializer) calls it and is not edited.
-- LEANS-CAP-down.sql reverses it.
begin;
do $$
declare fn oid;def text;cnt int;
 old_txt constant text=$o$'leans',(select coalesce(jsonb_agg(jsonb_build_object('f',l.fxid,'c',l.code,'q',round(l.prob,4),'m',l.market) order by l.fxid),'[]'::jsonb) from public.lean_picks l where l.fxid in(select fxid from ids)),$o$;
 new_txt constant text=$n$'leans',(select coalesce(jsonb_agg(jsonb_build_object('f',k.fxid,'c',k.code,'q',round(k.prob,4),'m',k.market) order by k.fxid),'[]'::jsonb) from (select l.fxid,l.code,l.prob,l.market from public.lean_picks l where l.fxid in(select fxid from ids) order by (l.kickoff<(statement_timestamp() at time zone 'UTC')::date),abs(l.kickoff-(statement_timestamp() at time zone 'UTC')::date),l.fxid limit 1500) k),$n$;
begin
 fn=to_regprocedure('mm_fixture_delivery.lean_projection(jsonb)');if fn is null then raise exception 'lean_projection missing';end if;
 def=pg_get_functiondef(fn);
 if position('limit 1500' in def)>0 then raise exception 'LEANS-CAP-up.sql is already installed';end if;
 cnt=(length(def)-length(replace(def,old_txt,'')))/length(old_txt);if cnt<>1 then raise exception 'Expected one leans list, found %',cnt;end if;
 execute replace(def,old_txt,new_txt);
 if (select proowner::regrole::text from pg_proc where oid=fn)<>'postgres' then raise exception 'lean_projection owner changed';end if;
 if not has_function_privilege('mm_display_materializer',fn,'EXECUTE') then raise exception 'materializer lost EXECUTE';end if;
 if (select proowner::regrole::text from pg_proc where oid='mm_fixture_delivery.materialize()'::regprocedure)<>'mm_display_materializer' then raise exception 'materialize owner changed';end if;
 if jsonb_array_length(mm_fixture_delivery.lean_projection('[]'::jsonb)->'leans')<>0 then raise exception 'empty card list must give no leans';end if;
end $$;
commit;
