-- STAGING ONLY. Run only in the staging project's administrative SQL connection (rdcbnvfnxenrpnnwxszs).
-- Never run against production. No table, row, edition, grant or token is changed.
--
-- WHY. From 2026-11-19 04:05 UTC every refresh was refused with HTTP 400 and the preview's last
-- edition expired at 2026-11-19 23:06 UTC. mm_fixture_delivery.payload_valid refused two things
-- the JavaScript validators already admit:
--
--  1. An EDITION-WIDE legacy byte gate. It measured the whole stripped edition (cards, board,
--     records and slips together) as PostgreSQL jsonb text against 524288 bytes. Old clients apply
--     their 512 KiB bound to ONE screen response, in compact JSON, and refuse an oversized one
--     themselves. The real 14-day window grew from 710 fixtures on 16 November to 858 on 20
--     November, and the stripped edition reached about 557,000 jsonb-text bytes, so every edition
--     was refused to protect stale tabs that already protect themselves. The 1 MiB bound on the
--     full edition, the 1000-card bound, the v1 analysis and >40-leg strip are all unchanged.
--  2. A board row's kickoff (d/t) compared with the fixture's. The row keeps the kickoff it was
--     built for; the provider reschedules between board builds. Identity stays fixture id,
--     competition and both teams, exactly as contract.mjs and the client check it.
--
-- Each statement is replaced only if it occurs exactly once. Owner, volatility, search_path and
-- grants are kept by CREATE OR REPLACE. STAGING-capacity-down.sql restores the original text.
begin;
do $$
declare
 fn oid=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');
 def text;
 legacy constant text=$old$ if octet_length(jsonb_set(jsonb_set(v,'{cards}',coalesce((select jsonb_agg(card-'analysis' order by ordinal) from jsonb_array_elements(v->'cards') with ordinality as c(card,ordinal)),'[]'::jsonb)),'{slips}',coalesce((select jsonb_agg(slip order by ordinal) from jsonb_array_elements(v->'slips') with ordinality as s(slip,ordinal) where jsonb_array_length(slip->'legs')<=40),'[]'::jsonb))::text)>524288 then return false;end if;$old$;
 legacy_new constant text=$new$ -- Legacy 512 KiB bound: enforced per screen response by legacy clients (STAGING-capacity-up.sql).$new$;
 board constant text=$old$ if c->>'lid'<>r->>'l' or c->>'home'<>r->>'h' or c->>'away'<>r->>'a' or c->>'date'<>r->>'d' or c->'time'<>r->'t' then return false;end if;$old$;
 board_new constant text=$new$ if c->>'lid'<>r->>'l' or c->>'home'<>r->>'h' or c->>'away'<>r->>'a' then return false;end if;$new$;
 cnt int;
begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
 if fn is null then raise exception 'mm_fixture_delivery.payload_valid(jsonb) not found';end if;
 def=pg_get_functiondef(fn);
 cnt=(length(def)-length(replace(def,legacy,'')))/length(legacy);if cnt<>1 then raise exception 'Expected exactly one edition-wide legacy byte gate, found %; refusing to edit',cnt;end if;
 cnt=(length(def)-length(replace(def,board,'')))/length(board);if cnt<>1 then raise exception 'Expected exactly one board kickoff comparison, found %; refusing to edit',cnt;end if;
 execute replace(replace(def,legacy,legacy_new),board,board_new);
 def=pg_get_functiondef(fn);
 if position(legacy in def)>0 or position(board in def)>0 or position(board_new in def)=0 or position('octet_length(v::text)>1048576' in def)=0 then raise exception 'Replacement not installed as reviewed';end if;
end$$;
commit;
