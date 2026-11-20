-- STAGING ONLY. NOT INSTALLED. Requires separate Director authorization (capacity Option A).
-- Run only in the staging project's administrative SQL connection (rdcbnvfnxenrpnnwxszs), after
-- STAGING-capacity-up.sql. Never run against production. No table, row, edition, grant or token changes.
--
-- WHY. The real 14-day window reached 858 cards / 872,196 bytes on 2026-11-20 and projects to about
-- 988 cards / 1,004,000 bytes on 26 November, against the 1000-card and 1 MiB edition bounds.
-- This raises exactly three bounds and nothing else:
--   mm_fixture_delivery.payload_valid : schema cards "max":1000 -> 1500, octet_length(v::text) 1048576 -> 2097152
--   mm_preview_mirror.publish         : octet_length(wire) 1048576 -> 2097152
-- The board's own 1000-row bound, the 128-slip bound, the 90/40-leg bounds and the legacy v1 strip
-- are unchanged. Each replaced text must occur exactly once or nothing is changed; a second run is
-- refused. Owner, volatility, SECURITY DEFINER, search_path and grants are kept by CREATE OR REPLACE.
-- STAGING-capacity2-down.sql restores the exact earlier text. Published editions are not touched.
--
-- AFTER INSTALLING: deploy the matching refresh.mjs / contract.mjs / index.html / original-logos.mjs.
-- Until then the JavaScript bounds still refuse a >1000-card edition before it reaches staging.
begin;
do $$
declare
 fn oid=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');
 def text;cnt int;
 cards constant text=$old$"updated_at","provider","prediction"],"nullable":false},"max":1000}$old$;
 cards_new constant text=$new$"updated_at","provider","prediction"],"nullable":false},"max":1500}$new$;
 bytes constant text=$old$octet_length(v::text)>1048576$old$;
 bytes_new constant text=$new$octet_length(v::text)>2097152$new$;
begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
 if fn is null then raise exception 'mm_fixture_delivery.payload_valid(jsonb) not found';end if;
 def=pg_get_functiondef(fn);
 cnt=(length(def)-length(replace(def,cards,'')))/length(cards);if cnt<>1 then raise exception 'Expected exactly one 1000-card schema bound, found %; refusing to edit',cnt;end if;
 cnt=(length(def)-length(replace(def,bytes,'')))/length(bytes);if cnt<>1 then raise exception 'Expected exactly one 1 MiB edition bound, found %; refusing to edit',cnt;end if;
 execute replace(replace(def,cards,cards_new),bytes,bytes_new);
 def=pg_get_functiondef(fn);
 if position(cards in def)>0 or position(bytes in def)>0 or position(cards_new in def)=0 or position(bytes_new in def)=0 then raise exception 'Replacement not installed as reviewed';end if;
end$$;
-- The publisher is owned by mm_preview_mirror_owner; the administrative role switches to it, as
-- STAGING-tips-continuity-up.sql does. SET LOCAL ends at commit.
set local role mm_preview_mirror_owner;
do $$
declare
 fn oid=to_regprocedure('mm_preview_mirror.publish(jsonb)');
 def text;cnt int;
 wire constant text=$old$octet_length(wire)>1048576$old$;
 wire_new constant text=$new$octet_length(wire)>2097152$new$;
begin
 if fn is null then raise exception 'mm_preview_mirror.publish(jsonb) not found';end if;
 def=pg_get_functiondef(fn);
 cnt=(length(def)-length(replace(def,wire,'')))/length(wire);if cnt<>1 then raise exception 'Expected exactly one 1 MiB wire bound, found %; refusing to edit',cnt;end if;
 execute replace(def,wire,wire_new);
 def=pg_get_functiondef(fn);
 if position(wire in def)>0 or position(wire_new in def)=0 then raise exception 'Replacement not installed as reviewed';end if;
end$$;
commit;
