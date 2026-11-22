-- PRODUCTION (toqfdrcjzwnlydqekude). Build 366: pre-match bookmaker odds reach the public app.
-- Build 355 read odds from public.odds_latest in the browser. Anonymous visitors cannot read the raw odds
-- tables on the bounded display, so the slip generator, the Tips prices and the match page had no prices
-- at all for them. The edition gains one optional top-level key, `odds`: for each carded fixture, its
-- capture closest to kick-off and never one taken after it (the same rule as odds_latest), consensus
-- medians for the markets the app uses (1X2, goals 1.5/2.5/3.5, BTTS, double chance, draw no bet).
-- No bookmaker names, no per-book prices, no capture history. It is served by a NEW function,
-- public.matchmind_odds_v1(), because old clients check the display envelope closed.
-- Issued picks (public.predictions), Leans and every record are not touched.
-- Owned functions change (mm_fixture_delivery.materialize, payload_valid), so the installer takes SET and
-- INHERIT on mm_display_materializer / mm_display_reader for this transaction and gives them back.
-- ODDS-DISPLAY-down.sql reverses it. One transaction. Each replaced text must occur exactly once.
begin;
do $$begin
 if to_regprocedure('mm_fixture_delivery.odds_projection(jsonb)') is not null then raise exception 'ODDS-DISPLAY-up.sql is already installed';end if;
 if to_regprocedure('mm_fixture_delivery.lean_projection(jsonb)') is null then raise exception 'LEAN-TIERS-up.sql must be installed first';end if;
end$$;
grant mm_display_materializer to postgres with set true, inherit true;
grant mm_display_reader to postgres with set true, inherit true;

-- The materializer reads the capture columns it projects, and nothing else of the table.
grant select (fxid,mins_to_kick,h,d,a,o15,u15,o25,u25,o35,u35,bttsy,bttsn,dc1x,dc12,dcx2,dnbh,dnba) on public.odds_snapshots to mm_display_materializer;
create policy materializer_odds_read on public.odds_snapshots for select to mm_display_materializer using (true);

create function mm_fixture_delivery.odds_projection(cards jsonb) returns jsonb
language sql stable set search_path=pg_catalog as $fn$
with ids as (select distinct (c->>'fxid')::bigint fxid from jsonb_array_elements(cards) c),
 o as (select distinct on (s.fxid) s.fxid,s.mins_to_kick,s.h,s.d,s.a,s.o15,s.u15,s.o25,s.u25,s.o35,s.u35,s.bttsy,s.bttsn,s.dc1x,s.dc12,s.dcx2,s.dnbh,s.dnba from public.odds_snapshots s join ids on ids.fxid=s.fxid
       where s.mins_to_kick is not null and s.mins_to_kick>=0 and s.h is not null
       order by s.fxid,s.mins_to_kick asc)
select jsonb_build_object('odds',coalesce(jsonb_agg(jsonb_build_object('f',o.fxid,'k',least(o.mins_to_kick,100000),'h',round(o.h,3),'d',round(o.d,3),'a',round(o.a,3),'o15',round(o.o15,3),'u15',round(o.u15,3),'o25',round(o.o25,3),'u25',round(o.u25,3),'o35',round(o.o35,3),'u35',round(o.u35,3),'bttsy',round(o.bttsy,3),'bttsn',round(o.bttsn,3),'dc1x',round(o.dc1x,3),'dc12',round(o.dc12,3),'dcx2',round(o.dcx2,3),'dnbh',round(o.dnbh,3),'dnba',round(o.dnba,3)) order by o.fxid),'[]'::jsonb)) from o
$fn$;
revoke all on function mm_fixture_delivery.odds_projection(jsonb) from public;
grant execute on function mm_fixture_delivery.odds_projection(jsonb) to mm_display_materializer;

do $do$
declare def text;cnt int;
 schema_old constant text=$o$$schema${"type":"object","properties":{"leans":$o$;
 schema_new constant text=$n$$schema${"type":"object","properties":{"odds":{"type":"array","items":{"type":"object","properties":{"f":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"k":{"type":"number","min":0,"max":100000,"nullable":false,"integer":true},"h":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"d":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"a":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o15":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u15":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o25":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u25":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"o35":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"u35":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"bttsy":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"bttsn":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dc1x":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dc12":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dcx2":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dnbh":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false},"dnba":{"type":"number","min":1,"max":10000,"nullable":true,"integer":false}},"required":["f","k","h","d","a","o15","u15","o25","u25","o35","u35","bttsy","bttsn","dc1x","dc12","dcx2","dnbh","dnba"],"nullable":false},"max":3000},"leans":$n$;
 built_old constant text=$o$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards);$o$;
 built_new constant text=$n$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards)||mm_fixture_delivery.odds_projection(cards);$n$;
begin
 def=pg_get_functiondef('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure);
 cnt=(length(def)-length(replace(def,schema_old,'')))/length(schema_old);if cnt<>1 then raise exception 'Expected one payload schema head, found %',cnt;end if;
 execute replace(def,schema_old,schema_new);
 def=pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure);
 cnt=(length(def)-length(replace(def,built_old,'')))/length(built_old);if cnt<>1 then raise exception 'Expected one edition assembly, found %',cnt;end if;
 execute replace(def,built_old,built_new);
 if (select proowner::regrole::text from pg_proc where oid='mm_fixture_delivery.materialize()'::regprocedure)<>'mm_display_materializer' then raise exception 'materialize owner changed';end if;
 if not mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[],"leans":[],"lean_record":null}'::jsonb) then raise exception 'payload_valid no longer admits an edition without odds';end if;
 if not mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[],"leans":[],"lean_record":null,"odds":[{"f":1,"k":30,"h":1.9,"d":1.9,"a":1.9,"o15":1.9,"u15":1.9,"o25":1.9,"u25":1.9,"o35":1.9,"u35":1.9,"bttsy":1.9,"bttsn":1.9,"dc1x":1.9,"dc12":1.9,"dcx2":1.9,"dnbh":1.9,"dnba":null}]}'::jsonb) then raise exception 'payload_valid does not admit the odds key';end if;
 if mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[],"odds":[{"f":1,"k":30,"h":0.5}]}'::jsonb) then raise exception 'payload_valid admits a malformed odds row';end if;
end $do$;

-- The read path for the odds of the current edition. Anonymous, bounded by the edition itself.
create function mm_fixture_delivery.odds() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare e record;
begin
 select edition_id,as_of,payload into e from mm_fixture_delivery.editions where as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
 if not found then raise exception 'Current presentation unavailable' using errcode='P0002';end if;
 return jsonb_build_object('version','matchmind-odds/1','edition_id',e.edition_id,'as_of',e.as_of,'odds',coalesce(e.payload->'odds','[]'::jsonb));
end $fn$;
grant create on schema mm_fixture_delivery to mm_display_reader;
alter function mm_fixture_delivery.odds() owner to mm_display_reader;
revoke create on schema mm_fixture_delivery from mm_display_reader;
revoke create on schema mm_fixture_delivery from mm_display_materializer;
revoke all on function mm_fixture_delivery.odds() from public;
grant execute on function mm_fixture_delivery.odds() to anon,authenticated;
create function public.matchmind_odds_v1() returns jsonb language sql stable set search_path=pg_catalog as $fn$select mm_fixture_delivery.odds()$fn$;
revoke all on function public.matchmind_odds_v1() from public;
grant execute on function public.matchmind_odds_v1() to anon,authenticated,service_role;

do $$declare r record;begin
 select p.proowner::regrole::text o,p.prosecdef s into r from pg_proc p where p.oid='mm_fixture_delivery.odds()'::regprocedure;
 if r.o<>'mm_display_reader' or not r.s then raise exception 'Unexpected odds() shape';end if;
 if has_table_privilege('anon','public.odds_snapshots','SELECT') then raise exception 'odds_snapshots readable by anon';end if;
 if has_column_privilege('mm_display_materializer','public.odds_snapshots','prices','SELECT') then raise exception 'materializer can read per-book prices';end if;
 if has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE') or has_schema_privilege('mm_display_materializer','mm_fixture_delivery','CREATE') then raise exception 'schema CREATE not given back';end if;
end$$;
grant mm_display_materializer to postgres with set false, inherit false;
grant mm_display_reader to postgres with set false, inherit false;
notify pgrst,'reload schema';
commit;
