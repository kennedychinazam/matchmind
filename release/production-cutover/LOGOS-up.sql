-- PRODUCTION (toqfdrcjzwnlydqekude), after PROPOSAL-up.sql. Restores Build 355's crests and
-- league logos to the bounded display: each edition/history card gains home_logo, away_logo and
-- llogo, copied from public.fixtures. Provider rights confirmed by the owner (2026-11-21).
-- ORDER: publish the client that accepts these fields FIRST. The 3a83995 client rejects any card
-- key it does not know, so installing this before that client is live empties the app.
-- Each replaced text must occur exactly once or nothing changes. LOGOS-down.sql reverses it.
-- Measured read-only on production 2026-11-21: edition 346eb922 is 660,164 bytes; the three
-- fields add 201,585 bytes for its 995 cards (about 862 KB, bound 2 MiB). Longest URL 66
-- characters; every value is https://media.api-sports.io/...; none null or non-https.
begin;
grant select(home_logo,away_logo,llogo) on public.fixtures to mm_display_materializer;
do $$
declare fn oid;def text;cnt int;
 props constant text=$old$"provider":{"type":"string","max":80,"nullable":true},"prediction":$old$;
 props_new constant text=$new$"provider":{"type":"string","max":80,"nullable":true},"home_logo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"away_logo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"llogo":{"type":"string","max":300,"nullable":true,"pattern":"^https://[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$"},"prediction":$new$;
 card_src constant text=$old$'updated_at',f.updated_at,'provider',f.provider,$old$;
 card_src_new constant text=$new$'updated_at',f.updated_at,'provider',f.provider,'home_logo',nullif(f.home_logo,''),'away_logo',nullif(f.away_logo,''),'llogo',nullif(f.llogo,''),$new$;
begin
 fn=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');if fn is null then raise exception 'payload_valid missing';end if;
 def=pg_get_functiondef(fn);
 if position('"home_logo"' in def)>0 then raise exception 'LOGOS-up.sql is already installed';end if;
 cnt=(length(def)-length(replace(def,props,'')))/length(props);if cnt<>1 then raise exception 'Expected one card provider/prediction schema boundary, found %',cnt;end if;
 if position($x$"max":1500}$x$ in def)=0 or position('2097152' in def)=0 then raise exception 'PROPOSAL-up.sql capacity edits not present; refusing';end if;
 execute replace(def,props,props_new);
 foreach def in array array[pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure),pg_get_functiondef('mm_fixture_delivery.history(date,bigint)'::regprocedure)] loop
  cnt=(length(def)-length(replace(def,card_src,'')))/length(card_src);if cnt<>1 then raise exception 'Expected one card projection, found %',cnt;end if;
  execute replace(def,card_src,card_src_new);
 end loop;
 -- Ownership, SECURITY DEFINER, search_path and grants are kept by CREATE OR REPLACE.
 if (select proowner::regrole::text from pg_proc where oid='mm_fixture_delivery.materialize()'::regprocedure)<>'mm_display_materializer' then raise exception 'materialize owner changed';end if;
 if not mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[]}'::jsonb) then raise exception 'payload_valid no longer admits an empty edition';end if;
end $$;
notify pgrst,'reload schema';
commit;
