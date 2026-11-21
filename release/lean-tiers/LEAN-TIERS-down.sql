-- PRODUCTION (toqfdrcjzwnlydqekude). Reverses LEAN-TIERS-up.sql. One transaction.
-- ORDER: publish a client that no longer calls matchmind_leans_v1 first, or accept that Leans disappear
-- (the Build 362 client treats a failed call as "no Leans" and shows Toss-up for those fixtures).
-- ⚠ This DROPS public.lean_picks and with it the frozen Lean record. Export it first if it is to be kept:
--   copy (select * from public.lean_picks order by fxid) to stdout with csv header;
-- Strong picks (public.predictions) are not touched.
begin;
do $$begin if to_regclass('public.lean_picks') is null then raise exception 'LEAN-TIERS-up.sql is not installed';end if;end$$;
grant mm_display_materializer to postgres with set true, inherit true;
grant mm_display_reader to postgres with set true, inherit true;
do $do$
declare def text;cnt int;
 schema_new constant text=$n$$schema${"type":"object","properties":{"leans":{"type":"array","items":{"type":"object","properties":{"f":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"c":{"type":"string","max":8,"nullable":false},"q":{"type":"number","min":0,"max":1,"nullable":false,"integer":false},"m":{"type":"string","max":40,"nullable":true}},"required":["f","c","q","m"],"nullable":false},"max":1500},"lean_record":{"type":"object","properties":{"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"graded":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"hit":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"void":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"pending":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"sum_p":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":false},"bins":{"type":"array","items":{"type":"object","properties":{"lo":{"type":"number","min":0,"max":1,"nullable":false,"integer":false},"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"hit":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"sum_p":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":false}},"required":["lo","n","hit","sum_p"],"nullable":false},"max":20}},"required":["n","graded","hit","void","pending","sum_p","bins"],"nullable":true},"cards":$n$;
 schema_old constant text=$o$$schema${"type":"object","properties":{"cards":$o$;
 built_new constant text=$n$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards);$n$;
 built_old constant text=$o$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips);$o$;
begin
 def=pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure);
 cnt=(length(def)-length(replace(def,built_new,'')))/length(built_new);if cnt<>1 then raise exception 'Expected one lean edition assembly, found %',cnt;end if;
 execute replace(def,built_new,built_old);
 def=pg_get_functiondef('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure);
 cnt=(length(def)-length(replace(def,schema_new,'')))/length(schema_new);if cnt<>1 then raise exception 'Expected one lean payload schema head, found %',cnt;end if;
 execute replace(def,schema_new,schema_old);
end $do$;
drop function public.matchmind_leans_v1();
drop function mm_fixture_delivery.leans();
drop function mm_fixture_delivery.lean_projection(jsonb);
drop table public.lean_picks;
drop function mm_fixture_delivery.lean_guard();
grant mm_display_materializer to postgres with set false, inherit false;
grant mm_display_reader to postgres with set false, inherit false;
notify pgrst,'reload schema';
commit;
