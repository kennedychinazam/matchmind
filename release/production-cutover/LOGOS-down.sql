-- PRODUCTION, reverses LOGOS-up.sql exactly. Editions already written keep their bytes (no data is
-- changed); new editions stop carrying the logo fields. The client that accepts the fields also
-- accepts their absence, so this can run with that client live.
begin;
do $$
declare fn oid;def text;cnt int;
 props constant text=$old$"provider":{"type":"string","max":80,"nullable":true},"home_logo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"away_logo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"llogo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"prediction":$old$;
 props_new constant text=$new$"provider":{"type":"string","max":80,"nullable":true},"prediction":$new$;
 card_src constant text=$old$'updated_at',f.updated_at,'provider',f.provider,'home_logo',nullif(f.home_logo,''),'away_logo',nullif(f.away_logo,''),'llogo',nullif(f.llogo,''),$old$;
 card_src_new constant text=$new$'updated_at',f.updated_at,'provider',f.provider,$new$;
begin
 fn=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');def=pg_get_functiondef(fn);
 cnt=(length(def)-length(replace(def,props,'')))/length(props);if cnt<>1 then raise exception 'LOGOS-up.sql schema text not found exactly once (%)',cnt;end if;
 foreach def in array array[pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure),pg_get_functiondef('mm_fixture_delivery.history(date,bigint)'::regprocedure)] loop
  cnt=(length(def)-length(replace(def,card_src,'')))/length(card_src);if cnt<>1 then raise exception 'LOGOS-up.sql projection not found exactly once (%)',cnt;end if;
 end loop;
 execute replace(pg_get_functiondef(fn),props,props_new);
 execute replace(pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure),card_src,card_src_new);
 execute replace(pg_get_functiondef('mm_fixture_delivery.history(date,bigint)'::regprocedure),card_src,card_src_new);
end $$;
revoke select(home_logo,away_logo,llogo) on public.fixtures from mm_display_materializer;
notify pgrst,'reload schema';
commit;
