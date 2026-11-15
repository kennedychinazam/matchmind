-- STAGING ONLY rollback of STAGING-tips-continuity-up.sql. Restores the current-day-only guard.
-- Unset MM_MIRROR_PREVIOUS_ISSUE BEFORE running this, or the next refresh will be refused.
-- Published editions are immutable and are not touched.
begin;
do $$
declare
 fn oid=to_regprocedure('mm_preview_mirror.publish(jsonb)');
 def text;
 new constant text=$new$ if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date not between d-1 and d) then raise exception 'Only current and previous-day issued slips admitted';end if;
 if (select count(*) from jsonb_array_elements(p->'slips') s) is distinct from (select count(distinct (s->>'day',s->>'tier')) from jsonb_array_elements(p->'slips') s) then raise exception 'Duplicate issued slip day and tier';end if;$new$;
 old constant text=$old$ if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date<>d) then raise exception 'Only current issued slips admitted';end if;$old$;
begin
 if fn is null then raise exception 'mm_preview_mirror.publish(jsonb) not found';end if;
 def=pg_get_functiondef(fn);
 if position(new in def)=0 then raise exception 'Continuity guard not installed; nothing to roll back';end if;
 execute replace(def,new,old);
end$$;
commit;
