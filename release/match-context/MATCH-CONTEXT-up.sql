-- PRODUCTION (toqfdrcjzwnlydqekude). Build 361: the per-match context behind the match detail.
-- Build 355 drew Goals Markets, Half-time / Full-time, Form, Head to head, the League Table and the
-- written analysis in the browser, from the competition's finished results that it read from
-- public.fixtures (60 months back, CACHE_MONTHS; upcoming fixtures 60 days ahead, LEAGUE_AHEAD_DAYS).
-- Anonymous visitors can no longer read that table, so those panels went empty on the bounded display.
-- This adds ONE function, public.matchmind_match_context_v1(fxid), called when a match detail opens.
-- For that fixture's competition only it returns the columns 355's unchanged functions read
-- (date, teams, 90-minute score, half-time score, season, round kind), the season's upcoming pairs
-- for the table roster, and the two sides' scorers this season counted from the stored goal events.
-- No odds, no fixture ids, no lineups, no provider extras, no other competition. Hard size bounds.
-- It reads; it never writes. Issued picks and historical records are not touched.
-- Owner: mm_match_context (NOLOGIN, NOINHERIT, no BYPASSRLS), with column SELECT on public.fixtures
-- and its own read policy. SECURITY DEFINER, search_path pg_catalog. EXECUTE to anon and authenticated.
-- MATCH-CONTEXT-down.sql reverses it. One transaction.
begin;
do $$begin
 if to_regprocedure('public.matchmind_match_context_v1(bigint)') is not null then raise exception 'MATCH-CONTEXT-up.sql is already installed';end if;
 if exists(select 1 from pg_roles where rolname='mm_match_context') then raise exception 'Role mm_match_context already exists; refusing';end if;
end$$;
create role mm_match_context nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
-- PostgreSQL 16+: a CREATEROLE installer holds ADMIN with SET FALSE on a role it creates, and owning
-- or granting on its behalf needs SET and INHERIT. Taken here, given back at the end.
do $$begin
 if not pg_catalog.pg_has_role(current_user,'mm_match_context','SET') or not pg_catalog.pg_has_role(current_user,'mm_match_context','USAGE') then
  execute format('grant mm_match_context to %I with set true, inherit true',current_user);
 end if;
end$$;
grant usage on schema public to mm_match_context;
grant select(fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,ht_h,ht_a,events,lineup_h,lineup_a) on public.fixtures to mm_match_context;
create policy match_context_read on public.fixtures for select to mm_match_context using (true);

create function public.matchmind_match_context_v1(fxid bigint) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $fn$
#variable_conflict use_column
declare
 f record; today date=(statement_timestamp() at time zone 'UTC')::date; from_d date; ahead date;
 teams jsonb; rounds jsonb; m jsonb; up jsonb; sc_h jsonb; sc_a jsonb; nm int; nt int; nu int; outp jsonb; nb int;
begin
 if fxid is null or fxid<=0 then raise exception 'Invalid fixture' using errcode='22023';end if;
 select x.fxid,x.lid,x.season,x.home,x.away,x.date into f from public.fixtures x where x.fxid=matchmind_match_context_v1.fxid;
 if not found or f.lid is null then return null;end if;
 -- 355 cacheCutoff(): today minus CACHE_MONTHS (60) calendar months; LEAGUE_AHEAD_DAYS 60.
 from_d=(today-interval '60 months')::date; ahead=today+60;
 -- 355 loader: every finished row (canonStatus FT/FINISHED/AET/PEN) with both goals, scored by settledScore
 -- (the 90-minute ft_h/ft_a pair when it is whole, non-negative and no greater than the final score),
 -- read ordered by date then fxid and kept in that order. Upcoming: NS from today to 60 days ahead.
 with base as(
  select row_number() over(order by r.date,r.fxid) ord,(r.date-from_d) d,r.home,r.away,
   case when r.ft_h is not null and r.ft_a is not null and r.ft_h>=0 and r.ft_a>=0 and r.ft_h<=r.gh and r.ft_a<=r.ga then r.ft_h else r.gh end hg,
   case when r.ft_h is not null and r.ft_a is not null and r.ft_h>=0 and r.ft_a>=0 and r.ft_h<=r.gh and r.ft_a<=r.ga then r.ft_a else r.ga end ag,
   r.ht_h hth,r.ht_a hta,r.season,
   case when r.round is null then null when position(' - ' in r.round)>0 then left(r.round,position(' - ' in r.round)-1) else r.round end rk
  from public.fixtures r
  where r.lid=f.lid and r.date>=from_d and r.date<=today and r.gh is not null and r.ga is not null
   and upper(btrim(coalesce(r.status,''),E' \t\r\n')) in ('FT','FINISHED','AET','PEN')),
 upc as(
  select x.date,x.fxid,x.home,x.away,x.season from public.fixtures x
  where x.lid=f.lid and x.date between today and ahead and upper(btrim(coalesce(x.status,''),E' \t\r\n'))='NS'),
 tn as(
  select t,(row_number() over(order by t collate "C"))-1 i from(
   select home t from base union select away from base union select home from upc union select away from upc
   union select f.home union select f.away) s where t is not null),
 rn as(select k,(row_number() over(order by k collate "C"))-1 i from(select distinct rk k from base where rk is not null) s)
 select (select coalesce(jsonb_agg(t order by i),'[]'::jsonb) from tn),(select count(*) from tn),
  (select coalesce(jsonb_agg(k order by i),'[]'::jsonb) from rn),
  (select coalesce(jsonb_agg(jsonb_build_array(b.d,th.i,ta.i,b.hg,b.ag,b.hth,b.hta,b.season,r.i) order by b.ord),'[]'::jsonb)
    from base b left join tn th on th.t=b.home left join tn ta on ta.t=b.away left join rn r on r.k=b.rk),
  (select count(*) from base),
  (select coalesce(jsonb_agg(jsonb_build_array(th.i,ta.i,u.season) order by u.date,u.fxid),'[]'::jsonb)
    from upc u left join tn th on th.t=u.home left join tn ta on ta.t=u.away),
  (select count(*) from upc)
 into teams,nt,rounds,m,nm,up,nu;
 if nm>6000 then raise exception 'Match context exceeds the 6000-result bound: %',nm using errcode='54000';end if;
 if nt>1500 then raise exception 'Match context exceeds the 1500-team bound: %',nt using errcode='54000';end if;
 if nu>1000 then raise exception 'Match context exceeds the 1000-upcoming bound: %',nu using errcode='54000';end if;
 -- Scorers for the two sides this season in this competition, from the stored goal events: a goal is a
 -- 'Goal' event that is not an own goal or a missed penalty; an appearance is a starting place or a
 -- substitute coming on. A provider team id is tied to a side through the starting line-ups.
 with fx as(
  select x.fxid,x.home,x.away,x.events,x.lineup_h,x.lineup_a from public.fixtures x
  where x.lid=f.lid and x.season is not distinct from f.season and upper(btrim(coalesce(x.status,''),E' \t\r\n')) in ('FT','FINISHED','AET','PEN')
   and (x.home in(f.home,f.away) or x.away in(f.home,f.away)) and jsonb_typeof(x.events)='array'),
 xi as(
  select fx.fxid,fx.home team,(p->>'id')::bigint pid from fx,jsonb_array_elements(case when jsonb_typeof(fx.lineup_h->'xi')='array' then fx.lineup_h->'xi' else '[]' end) p where p->>'id'~'^[0-9]{1,12}$'
  union all
  select fx.fxid,fx.away,(p->>'id')::bigint from fx,jsonb_array_elements(case when jsonb_typeof(fx.lineup_a->'xi')='array' then fx.lineup_a->'xi' else '[]' end) p where p->>'id'~'^[0-9]{1,12}$'),
 ev as(
  select fx.fxid,e->>'type' typ,e->>'detail' det,(e->>'team') tid,
   case when e->>'pid'~'^[0-9]{1,12}$' then (e->>'pid')::bigint end pid,case when e->>'aid'~'^[0-9]{1,12}$' then (e->>'aid')::bigint end aid,
   left(btrim(e->>'player'),80) pname
  from fx,jsonb_array_elements(fx.events) e where jsonb_typeof(e)='object'),
 tmap as(
  select tid,team from(select ev.tid,xi.team,count(*) n,row_number() over(partition by ev.tid order by count(*) desc,xi.team) rn
   from ev join xi on xi.fxid=ev.fxid and xi.pid=ev.pid where ev.tid is not null group by 1,2) s where rn=1),
 goals as(
  select tm.team,ev.pid,count(*) g,(array_agg(ev.pname order by ev.fxid desc))[1] pname from ev join tmap tm on tm.tid=ev.tid
  where ev.typ='Goal' and coalesce(ev.det,'') not in('Own Goal','Missed Penalty') and ev.pid is not null and ev.pname<>'' and tm.team in(f.home,f.away) group by 1,2),
 apps as(
  select team,pid,count(distinct fxid) n from(select xi.team,xi.pid,xi.fxid from xi union all
   select tm.team,ev.aid,ev.fxid from ev join tmap tm on tm.tid=ev.tid where ev.typ='subst' and ev.aid is not null) a group by 1,2)
 select
  coalesce(jsonb_agg(jsonb_build_array(g.pname,g.g,coalesce(a.n,0)) order by g.g desc,g.pname) filter(where g.team=f.home and g.rk<=40),'[]'::jsonb),
  coalesce(jsonb_agg(jsonb_build_array(g.pname,g.g,coalesce(a.n,0)) order by g.g desc,g.pname) filter(where g.team=f.away and g.rk<=40),'[]'::jsonb)
 into sc_h,sc_a
 from (select goals.*,row_number() over(partition by team order by g desc,pname) rk from goals) g left join apps a on a.team=g.team and a.pid=g.pid;
 outp=jsonb_build_object('version','matchmind-match-context/1','fxid',f.fxid,'lid',f.lid,'season',f.season,'home',f.home,'away',f.away,
  'from',from_d,'to',today,'as_of',statement_timestamp(),'teams',teams,'rounds',rounds,'m',m,'up',up,
  'scorers',jsonb_build_object('season',f.season,'home',sc_h,'away',sc_a));
 nb=octet_length(outp::text);
 if nb>786432 then raise exception 'Match context exceeds the 768 KiB bound: % bytes',nb using errcode='54000';end if;
 return outp;
end $fn$;
-- Owning a function needs CREATE on its schema; taken for the transfer only.
grant create on schema public to mm_match_context;
alter function public.matchmind_match_context_v1(bigint) owner to mm_match_context;
revoke create on schema public from mm_match_context;
revoke all on function public.matchmind_match_context_v1(bigint) from public;
grant execute on function public.matchmind_match_context_v1(bigint) to anon,authenticated,service_role;
do $$declare r record;begin
 select p.proowner::regrole::text o,p.prosecdef s,p.proconfig c into r from pg_proc p where p.oid='public.matchmind_match_context_v1(bigint)'::regprocedure;
 if r.o<>'mm_match_context' or not r.s or r.c<>array['search_path=pg_catalog'] then raise exception 'Unexpected function shape % % %',r.o,r.s,r.c;end if;
 if has_table_privilege('anon','public.fixtures','SELECT') or has_column_privilege('anon','public.fixtures','home','SELECT') then raise exception 'anon must not read public.fixtures';end if;
 if not has_function_privilege('anon','public.matchmind_match_context_v1(bigint)','EXECUTE') then raise exception 'anon cannot execute';end if;
 if exists(select 1 from pg_roles where rolname='mm_match_context' and (rolcanlogin or rolbypassrls or rolsuper or rolinherit)) then raise exception 'mm_match_context is not narrow';end if;
end$$;
do $$begin execute format('revoke mm_match_context from %I',current_user);exception when others then null;end$$;
notify pgrst,'reload schema';
commit;
