-- PRODUCTION (toqfdrcjzwnlydqekude). Build 362: the Lean tier.
-- Adds public.lean_picks, a frozen, insert-only store of Lean calls (the best call between 0.65 and the
-- Strong bar), written only by a scoped publisher before kick-off. The edition gains two optional
-- top-level keys, `leans` (one small row per carded fixture with a Lean) and `lean_record` (the Leans'
-- own graded record). Neither is served by matchmind_display_v1, whose envelope old clients check
-- closed: they are read through a NEW function, public.matchmind_leans_v1(). Old clients never call it.
-- Issued Strong picks (public.predictions) and every existing record are not touched.
-- Owned functions change (mm_fixture_delivery.materialize, payload_valid), so the installer takes SET
-- and INHERIT on mm_display_materializer / mm_display_reader for this transaction and gives them back.
-- LEAN-TIERS-down.sql reverses it. One transaction. Each replaced text must occur exactly once.
begin;
do $$begin
 if to_regclass('public.lean_picks') is not null then raise exception 'LEAN-TIERS-up.sql is already installed';end if;
end$$;
-- Role membership, taken for the transaction (postgres holds both with SET FALSE, INHERIT FALSE).
grant mm_display_materializer to postgres with set true, inherit true;
grant mm_display_reader to postgres with set true, inherit true;

create table public.lean_picks(
 fxid bigint primary key,
 lid bigint not null,
 code text not null check (code in ('1','X','2','1X','X2','1D','2D','O25','U25','U35','BTS','NBT')),
 market text check (market is null or length(market)<=40),
 prob numeric not null check (prob>=0.65 and prob<=1),
 p_home numeric check (p_home between 0 and 1),
 p_draw numeric check (p_draw between 0 and 1),
 p_away numeric check (p_away between 0 and 1),
 kickoff date not null,
 ktime text check (ktime is null or length(ktime)<=12),
 build integer not null check (build between 362 and 1000000),
 made_at timestamptz not null default statement_timestamp()
);
alter table public.lean_picks enable row level security;
revoke all on public.lean_picks from public, anon, authenticated;
grant select, insert on public.lean_picks to authenticated;
grant select on public.lean_picks to mm_display_materializer;
create policy lean_publisher_insert on public.lean_picks for insert to authenticated with check ((select mm_fixture_delivery.publisher_scope()));
create policy lean_raw_read on public.lean_picks for select to authenticated using ((select mm_fixture_delivery.raw_allowed()));
create policy materializer_read on public.lean_picks for select to mm_display_materializer using (true);

-- The freeze. Runs as mm_display_materializer, which already reads fixtures and predictions.
create function mm_fixture_delivery.lean_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
declare f record; ko timestamptz;
begin
 if tg_op<>'INSERT' then raise exception 'A Lean is frozen: % is not allowed',tg_op using errcode='42501';end if;
 select x.lid,x.date,x.time,x.status into f from public.fixtures x where x.fxid=new.fxid;
 if not found then raise exception 'Lean for an unknown fixture' using errcode='23503';end if;
 if f.lid<>new.lid or f.date::date<>new.kickoff then raise exception 'Lean identity does not match its fixture' using errcode='23514';end if;
 if f.status is distinct from 'NS' then raise exception 'Lean after kick-off is refused' using errcode='23514';end if;
 ko=case when f.time ~ '^[0-9]{1,2}:[0-9]{2}' then (f.date::date+substring(f.time from '^[0-9]{1,2}:[0-9]{2}')::time) at time zone 'UTC' else f.date::date::timestamp at time zone 'UTC' end;
 if ko<=statement_timestamp() then raise exception 'Lean after kick-off is refused' using errcode='23514';end if;
 if f.date::date>(statement_timestamp() at time zone 'UTC')::date+8 then raise exception 'Lean too far ahead' using errcode='23514';end if;
 if exists(select 1 from public.predictions p where p.fxid=new.fxid) then raise exception 'Fixture already has a Strong pick' using errcode='23514';end if;
 new.made_at=statement_timestamp();
 return new;
end $fn$;
grant create on schema mm_fixture_delivery to mm_display_materializer;
alter function mm_fixture_delivery.lean_guard() owner to mm_display_materializer;
revoke all on function mm_fixture_delivery.lean_guard() from public;
create trigger lean_freeze before insert or update or delete on public.lean_picks for each row execute function mm_fixture_delivery.lean_guard();

-- The edition's Lean projection, called by materialize (as mm_display_materializer).
create function mm_fixture_delivery.lean_projection(cards jsonb) returns jsonb
language sql stable set search_path=pg_catalog as $fn$
with ids as (select (c->>'fxid')::bigint fxid from jsonb_array_elements(cards) c),
 g as (select l.code,l.prob,f.status,f.gh,f.ga,
   case when f.status not in ('FINISHED','FT','AET','PEN') or f.gh is null or f.ga is null then null
        when f.ft_h is not null and f.ft_a is not null and f.ft_h between 0 and f.gh and f.ft_a between 0 and f.ga then f.ft_h
        when f.status in ('AET','PEN') then null else f.gh end h,
   case when f.status not in ('FINISHED','FT','AET','PEN') or f.gh is null or f.ga is null then null
        when f.ft_h is not null and f.ft_a is not null and f.ft_h between 0 and f.gh and f.ft_a between 0 and f.ga then f.ft_a
        when f.status in ('AET','PEN') then null else f.ga end a
  from public.lean_picks l join public.fixtures f on f.fxid=l.fxid),
 r as (select prob,h,a,case when h is null then null
   when code='1' then (case when h>a then 'hit' else 'miss' end)
   when code='X' then (case when h=a then 'hit' else 'miss' end)
   when code='2' then (case when h<a then 'hit' else 'miss' end)
   when code='1X' then (case when h>=a then 'hit' else 'miss' end)
   when code='X2' then (case when h<=a then 'hit' else 'miss' end)
   when code='1D' then (case when h>a then 'hit' when h=a then 'void' else 'miss' end)
   when code='2D' then (case when h<a then 'hit' when h=a then 'void' else 'miss' end)
   when code='O25' then (case when h+a>2 then 'hit' else 'miss' end)
   when code='U25' then (case when h+a<3 then 'hit' else 'miss' end)
   when code='U35' then (case when h+a<4 then 'hit' else 'miss' end)
   when code='BTS' then (case when h>0 and a>0 then 'hit' else 'miss' end)
   when code='NBT' then (case when h>0 and a>0 then 'miss' else 'hit' end) end gr from g),
 bins as (select floor(prob*20)/20.0 lo,count(*) n,count(*) filter(where gr='hit') hit,round(sum(prob),4) sp from r where gr in ('hit','miss') group by 1)
select jsonb_build_object(
 'leans',(select coalesce(jsonb_agg(jsonb_build_object('f',l.fxid,'c',l.code,'q',round(l.prob,4),'m',l.market) order by l.fxid),'[]'::jsonb) from public.lean_picks l where l.fxid in(select fxid from ids)),
 'lean_record',(select case when count(*)=0 then 'null'::jsonb else jsonb_build_object('n',count(*),'graded',count(*) filter(where gr is not null),'hit',count(*) filter(where gr='hit'),
   'void',count(*) filter(where gr='void'),'pending',count(*) filter(where gr is null),'sum_p',coalesce(round(sum(prob) filter(where gr in ('hit','miss')),4),0),
   'bins',(select coalesce(jsonb_agg(jsonb_build_object('lo',lo,'n',n,'hit',hit,'sum_p',sp) order by lo),'[]'::jsonb) from bins)) end from r))
$fn$;
revoke all on function mm_fixture_delivery.lean_projection(jsonb) from public;
grant execute on function mm_fixture_delivery.lean_projection(jsonb) to mm_display_materializer;

do $do$
declare def text;cnt int;
 schema_old constant text=$o$$schema${"type":"object","properties":{"cards":$o$;
 schema_new constant text=$n$$schema${"type":"object","properties":{"leans":{"type":"array","items":{"type":"object","properties":{"f":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"c":{"type":"string","max":8,"nullable":false},"q":{"type":"number","min":0,"max":1,"nullable":false,"integer":false},"m":{"type":"string","max":40,"nullable":true}},"required":["f","c","q","m"],"nullable":false},"max":1500},"lean_record":{"type":"object","properties":{"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"graded":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"hit":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"void":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"pending":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"sum_p":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":false},"bins":{"type":"array","items":{"type":"object","properties":{"lo":{"type":"number","min":0,"max":1,"nullable":false,"integer":false},"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"hit":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"sum_p":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":false}},"required":["lo","n","hit","sum_p"],"nullable":false},"max":20}},"required":["n","graded","hit","void","pending","sum_p","bins"],"nullable":true},"cards":$n$;
 built_old constant text=$o$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips);$o$;
 built_new constant text=$n$built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips)||mm_fixture_delivery.lean_projection(cards);$n$;
begin
 def=pg_get_functiondef('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure);
 cnt=(length(def)-length(replace(def,schema_old,'')))/length(schema_old);if cnt<>1 then raise exception 'Expected one payload schema head, found %',cnt;end if;
 execute replace(def,schema_old,schema_new);
 def=pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure);
 cnt=(length(def)-length(replace(def,built_old,'')))/length(built_old);if cnt<>1 then raise exception 'Expected one edition assembly, found %',cnt;end if;
 execute replace(def,built_old,built_new);
 if (select proowner::regrole::text from pg_proc where oid='mm_fixture_delivery.materialize()'::regprocedure)<>'mm_display_materializer' then raise exception 'materialize owner changed';end if;
 if not mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[]}'::jsonb) then raise exception 'payload_valid no longer admits an empty edition';end if;
 if not mm_fixture_delivery.payload_valid('{"cards":[],"board":null,"records":{"engine":null,"clv":null},"slips":[],"leans":[],"lean_record":null}'::jsonb) then raise exception 'payload_valid does not admit the lean keys';end if;
end $do$;

-- The read path for the Leans of the current edition.
create function mm_fixture_delivery.leans() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare e record;
begin
 select edition_id,as_of,payload into e from mm_fixture_delivery.editions where as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
 if not found then raise exception 'Current presentation unavailable' using errcode='P0002';end if;
 return jsonb_build_object('version','matchmind-leans/1','edition_id',e.edition_id,'as_of',e.as_of,
  'leans',coalesce(e.payload->'leans','[]'::jsonb),'record',coalesce(e.payload->'lean_record','null'::jsonb));
end $fn$;
grant create on schema mm_fixture_delivery to mm_display_reader;
alter function mm_fixture_delivery.leans() owner to mm_display_reader;
revoke create on schema mm_fixture_delivery from mm_display_reader;
revoke create on schema mm_fixture_delivery from mm_display_materializer;
revoke all on function mm_fixture_delivery.leans() from public;
grant execute on function mm_fixture_delivery.leans() to anon,authenticated;
create function public.matchmind_leans_v1() returns jsonb language sql stable set search_path=pg_catalog as $fn$select mm_fixture_delivery.leans()$fn$;
revoke all on function public.matchmind_leans_v1() from public;
grant execute on function public.matchmind_leans_v1() to anon,authenticated,service_role;

do $$declare r record;begin
 select p.proowner::regrole::text o,p.prosecdef s into r from pg_proc p where p.oid='mm_fixture_delivery.leans()'::regprocedure;
 if r.o<>'mm_display_reader' or not r.s then raise exception 'Unexpected leans() shape';end if;
 select p.proowner::regrole::text o,p.prosecdef s into r from pg_proc p where p.oid='mm_fixture_delivery.lean_guard()'::regprocedure;
 if r.o<>'mm_display_materializer' or not r.s then raise exception 'Unexpected lean_guard() shape';end if;
 if has_table_privilege('anon','public.lean_picks','SELECT') or has_table_privilege('authenticated','public.lean_picks','UPDATE') or has_table_privilege('authenticated','public.lean_picks','DELETE') then raise exception 'lean_picks grants too wide';end if;
 if has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE') or has_schema_privilege('mm_display_materializer','mm_fixture_delivery','CREATE') then raise exception 'schema CREATE not given back';end if;
end$$;
-- Give the memberships back exactly as they were.
grant mm_display_materializer to postgres with set false, inherit false;
grant mm_display_reader to postgres with set false, inherit false;
notify pgrst,'reload schema';
commit;
