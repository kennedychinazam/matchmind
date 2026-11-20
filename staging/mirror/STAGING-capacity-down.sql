-- STAGING ONLY. Restores the exact payload_valid text replaced by STAGING-capacity-up.sql.
-- Published editions are immutable and are not touched. With the original text the writer again
-- refuses editions whose stripped jsonb text exceeds 524288 bytes, so refresh stops at the current
-- real inventory; run this only to return to the earlier reviewed policy.
begin;
do $$
declare
 fn oid=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');
 def text;
 legacy constant text=$old$ if octet_length(jsonb_set(jsonb_set(v,'{cards}',coalesce((select jsonb_agg(card-'analysis' order by ordinal) from jsonb_array_elements(v->'cards') with ordinality as c(card,ordinal)),'[]'::jsonb)),'{slips}',coalesce((select jsonb_agg(slip order by ordinal) from jsonb_array_elements(v->'slips') with ordinality as s(slip,ordinal) where jsonb_array_length(slip->'legs')<=40),'[]'::jsonb))::text)>524288 then return false;end if;$old$;
 legacy_new constant text=$new$ -- Legacy 512 KiB bound: enforced per screen response by legacy clients (STAGING-capacity-up.sql).$new$;
 board constant text=$old$ if c->>'lid'<>r->>'l' or c->>'home'<>r->>'h' or c->>'away'<>r->>'a' or c->>'date'<>r->>'d' or c->'time'<>r->'t' then return false;end if;$old$;
 board_new constant text=$new$ if c->>'lid'<>r->>'l' or c->>'home'<>r->>'h' or c->>'away'<>r->>'a' then return false;end if;$new$;
begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
 def=pg_get_functiondef(fn);
 if position(legacy_new in def)=0 or position(board_new in def)=0 then raise exception 'STAGING-capacity-up.sql is not installed; nothing to roll back';end if;
 execute replace(replace(def,legacy_new,legacy),board_new,board);
 def=pg_get_functiondef(fn);
 if position(legacy in def)=0 or position(board in def)=0 then raise exception 'Rollback not installed';end if;
end$$;
commit;
