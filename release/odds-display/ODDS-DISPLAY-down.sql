-- PRODUCTION (toqfdrcjzwnlydqekude). Reverses ODDS-DISPLAY-up.sql. One transaction.
-- The Build 366 client treats a failed matchmind_odds_v1 call as "no prices", which is the state before.
-- No odds row, pick or record is touched; only the edition stops carrying `odds`.
begin;
do $$begin if to_regprocedure('mm_fixture_delivery.odds_projection(jsonb)') is null then raise exception 'ODDS-DISPLAY-up.sql is not installed';end if;end$$;
grant mm_display_materializer to postgres with set true, inherit true;
grant mm_display_reader to postgres with set true, inherit true;
do $do$
declare def text;cnt int;
 schema_new constant text=$n$$schema${"type":"object","properties":{"odds":{"type":"array","items":{"type":"object","properties":{"f":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"k":{"type":"number","min":0,"max":100000,"nullable":false,"integer":true},"h":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"d":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"a":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o15":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u15":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o25":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u25":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o35":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u35":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"bttsy":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"bttsn":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dc1x":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dc12":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dcx2":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dnbh":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dnba":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false}},"required":["f","k","h","d","a","o15","u15","o25","u25","o35","u35","bttsy","bttsn","dc1x","dc12","dcx2","dnbh","dnba"],"nullable":false},"max":3000},"leans":$n$;
 schema_old constant text=$o$$schema${"type":"object","properties":{"leans":$o$;
 built_new constant text=$n$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards)||mm_fixture_delivery.odds_projection(cards);$n$;
 built_old constant text=$o$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards);$o$;
begin
 def=pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure);
 cnt=(length(def)-length(replace(def,built_new,'')))/length(built_new);if cnt<>1 then raise exception 'Expected one odds edition assembly, found %',cnt;end if;
 execute replace(def,built_new,built_old);
 def=pg_get_functiondef('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure);
 cnt=(length(def)-length(replace(def,schema_new,'')))/length(schema_new);if cnt<>1 then raise exception 'Expected one odds payload schema head, found %',cnt;end if;
 execute replace(def,schema_new,schema_old);
end $do$;
drop function public.matchmind_odds_v1();
drop function mm_fixture_delivery.odds();
drop function mm_fixture_delivery.odds_projection(jsonb);
drop policy materializer_odds_read on public.odds_snapshots;
revoke select (fxid,mins_to_kick,h,d,a,o15,u15,o25,u25,o35,u35,bttsy,bttsn,dc1x,dc12,dcx2,dnbh,dnba) on public.odds_snapshots from mm_display_materializer;
grant mm_display_materializer to postgres with set false, inherit false;
grant mm_display_reader to postgres with set false, inherit false;
notify pgrst,'reload schema';
commit;
