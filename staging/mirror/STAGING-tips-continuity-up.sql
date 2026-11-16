-- STAGING ONLY. NOT INSTALLED. Requires separate Director authorization before it is run.
-- Run only in the staging project's administrative SQL connection (project rdcbnvfnxenrpnnwxszs).
-- Never run against production. No table, row, edition, grant or token is changed.
--
-- PURPOSE. mm_preview_mirror.publish refuses any issued slip whose day is not the current UTC day:
--   if exists(... where (s->>'day')::date<>d) then raise exception 'Only current issued slips admitted'
-- From 00:00 UTC until the day's Tips are issued the mirror therefore carries no Tips at all. This
-- replaces that one statement so the current AND the previous UTC day are admitted, and adds one
-- integrity guard: no two slips may share a day and tier. Every other line of the function, its
-- owner, its security-definer setting, its grants and its token check are left exactly as installed.
--
-- AFTER INSTALLING: set MM_MIRROR_PREVIOUS_ISSUE=1 for the refresh step of the preview workflow.
-- Until then staging/mirror/refresh.mjs keeps reading the current day only and nothing changes.
begin;
-- The administrative role is a member of the owner with INHERIT false, so it must switch to the
-- owner to replace the function, as STAGING-analysis-up.sql does. SET LOCAL ends at commit.
set local role mm_preview_mirror_owner;
do $$
declare
 fn oid=to_regprocedure('mm_preview_mirror.publish(jsonb)');
 def text;
 old constant text=$old$ if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date<>d) then raise exception 'Only current issued slips admitted';end if;$old$;
 new constant text=$new$ if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date not between d-1 and d) then raise exception 'Only current and previous-day issued slips admitted';end if;
 if (select count(*) from jsonb_array_elements(p->'slips') s) is distinct from (select count(distinct (s->>'day',s->>'tier')) from jsonb_array_elements(p->'slips') s) then raise exception 'Duplicate issued slip day and tier';end if;$new$;
begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
 if fn is null then raise exception 'mm_preview_mirror.publish(jsonb) not found';end if;
 def=pg_get_functiondef(fn);
 if (length(def)-length(replace(def,old,'')))/length(old)<>1 then raise exception 'Expected exactly one current-day slip guard; refusing to edit';end if;
 execute replace(def,old,new);
 if position(new in pg_get_functiondef(fn))=0 then raise exception 'Replacement not installed';end if;
end$$;
commit;
