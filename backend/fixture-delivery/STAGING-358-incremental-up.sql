-- FORWARD: installed ecf001f interface -> Build 358 rolling-window interface
-- STAGING PROJECT rdcbnvfnxenrpnnwxszs ONLY. Never production. Not a fresh install: it creates no
-- schema, role, table or policy, and it never runs PROPOSAL-up.sql.
-- Changes exactly two function bodies, mm_fixture_delivery.display(text) and
-- mm_fixture_delivery.materialize(), by CREATE OR REPLACE, which keeps owner, ACL, SECURITY
-- DEFINER, volatility and search_path. Editions, fixtures, predictions and principals are read
-- for fingerprints and never written.
-- GUARDED: it refuses (raises, transaction rolls back, nothing changes) unless all 12 function
-- bodies match the expected md5 pins below, and it refuses to commit unless owners, ACLs and
-- config of every function, and the data fingerprints, are identical after the change.
begin;
create temp table mm_pre on commit drop as
 select (p.pronamespace::regnamespace::text||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')') as fn, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.provolatile,
        coalesce(p.proconfig::text,'') as cfg, coalesce(p.proacl::text,'') as acl, md5(p.prosrc) as src
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='mm_fixture_delivery' or (n.nspname='public' and p.proname in ('matchmind_display_v1','matchmind_fixture_access_v1','matchmind_publish_display_v1'));
create temp table mm_pre_data on commit drop as
 select (select count(*) from public.fixtures) fixtures, (select count(*) from public.predictions) predictions,
        (select count(*) from mm_fixture_delivery.editions) editions,
        (select md5(coalesce(string_agg(e::text,'|' order by e.edition_id),'')) from mm_fixture_delivery.editions e) editions_md5,
        (select md5(coalesce(string_agg(f::text,'|' order by f.fxid),'')) from public.fixtures f) fixtures_md5,
        (select md5(coalesce(string_agg(p::text,'|' order by p.fxid),'')) from public.predictions p) predictions_md5,
        (select md5(coalesce(string_agg(r::text,'|' order by r.user_id),'')) from mm_fixture_delivery.principals r) principals_md5;
do $$declare bad text;begin
 if current_database() is null then raise exception 'no database'; end if;
 -- 1. the whole function inventory must be exactly the expected 12
 if (select count(*) from mm_pre)<>12 then raise exception 'REFUSED: expected 12 functions, found %',(select count(*) from mm_pre);end if;
 select string_agg(fn,', ') into bad from mm_pre where not (
  (fn='mm_fixture_delivery.display(text)' and src='f5bc8baa47c0db53d9e2605dab06a5c9') or
  (fn='mm_fixture_delivery.materialize()' and src='8e8eef4cf65458e7da5f5b23b923d79a') or
  (fn,src) in (select fn,src from (values
   ('public.matchmind_display_v1(text)','7e861989cd3a3ad3908c4f7d0d948b51'),
   ('public.matchmind_fixture_access_v1()','8a76e9e0dd80875fc3b5d989868cf969'),
   ('public.matchmind_publish_display_v1()','d984854f258fd6d3af1fd5b66505e41a'),
   ('mm_fixture_delivery.payload_valid(jsonb)','ff11bcbb1e4753f58936c5be8e26acd3'),
   ('mm_fixture_delivery.prediction_count(jsonb)','918bf896d68a7434a730a4bb609295f3'),
   ('mm_fixture_delivery.publisher_allowed()','e2ee192b1ca13ed01981ddacf5762380'),
   ('mm_fixture_delivery.raw_allowed()','4575b5cec6687a31f8a5e96df3803f00'),
   ('mm_fixture_delivery.raw_expiry()','5106923b0031ab712afd961b5f091851'),
   ('mm_fixture_delivery.request_uid()','8104a5defc1b413bda7633c4bd8d0129'),
   ('mm_fixture_delivery.schema_valid(jsonb, jsonb, integer)','9e01cca8178efd87d792514c894af3a0')) v(fn,src)));
 if bad is not null then raise exception 'REFUSED: installed function bodies differ from the expected baseline: %',bad;end if;
 -- 2. owners and security attributes of the two functions to replace
 if not exists(select 1 from mm_pre where fn='mm_fixture_delivery.display(text)' and owner='mm_display_reader' and prosecdef and provolatile='s' and cfg='{search_path=pg_catalog}') then raise exception 'REFUSED: display() owner or attributes differ from baseline';end if;
 if not exists(select 1 from mm_pre where fn='mm_fixture_delivery.materialize()' and owner='mm_display_materializer' and prosecdef and provolatile='v' and cfg='{search_path=pg_catalog}') then raise exception 'REFUSED: materialize() owner or attributes differ from baseline';end if;
 -- 3. nothing may be EXECUTE to PUBLIC before we start
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='mm_fixture_delivery' and a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'REFUSED: a private function is EXECUTE to PUBLIC before the change';end if;
 -- 4. the same S1 preconditions the installer used: take SET on the two owner roles, narrowly
 if not pg_catalog.pg_has_role(current_user,'mm_display_reader','SET') then
  begin execute format('grant mm_display_reader to %I with set true',current_user);
  exception when insufficient_privilege then raise exception 'REFUSED: % cannot take SET ROLE on mm_display_reader. A role administrator must run this',current_user;end;
  perform set_config('mm_fixture_delivery.set_reader','1',true);
 end if;
 if not pg_catalog.pg_has_role(current_user,'mm_display_materializer','SET') then
  begin execute format('grant mm_display_materializer to %I with set true',current_user);
  exception when insufficient_privilege then raise exception 'REFUSED: % cannot take SET ROLE on mm_display_materializer. A role administrator must run this',current_user;end;
  perform set_config('mm_fixture_delivery.set_materializer','1',true);
 end if;
end $$;
-- CREATE OR REPLACE still needs CREATE on the schema. Taken for the two owners, given back below.
grant create on schema mm_fixture_delivery to mm_display_reader, mm_display_materializer;
set local role mm_display_reader;
create or replace function mm_fixture_delivery.display(screen text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare e mm_fixture_delivery.editions%rowtype;outp jsonb;screen_cards jsonb;day_utc date=(statement_timestamp() at time zone 'UTC')::date;
begin
 if screen not in ('scores','predictions','history','records','slips') or screen is null then raise exception 'Unsupported display screen' using errcode='22023';end if;
 -- ROLLING WINDOW. Admission is as_of/expires_at only: a calendar-date equality here made an
 -- edition published at 23:17 UTC inadmissible from the next midnight, so the feed went dark until
 -- the 05:17 run. edition_day remains created-day metadata and is deliberately not a filter.
 select * into e from mm_fixture_delivery.editions where as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
 if not found then raise exception 'Current presentation unavailable' using errcode='P0002';end if;
 -- Select only this fixed app screen's necessary membership; never caller dates/IDs/offsets.
 if screen='scores' then
  select coalesce(jsonb_agg(jsonb_set(c,'{prediction}','null'::jsonb) order by c->>'date',c->>'fxid'),'[]'::jsonb) into screen_cards from jsonb_array_elements(e.payload->'cards') c where(c->>'date')::date between day_utc-6 and day_utc+7;
 elsif screen='predictions' then
  select coalesce(jsonb_agg(c order by c->>'date',c->>'fxid'),'[]'::jsonb) into screen_cards from jsonb_array_elements(e.payload->'cards') c where(c->>'date')::date between day_utc-1 and day_utc+7 or exists(select 1 from jsonb_array_elements(e.payload->'board'->'rows') b where b->>'f'=c->>'fxid');
 elsif screen='history' then
  select coalesce(jsonb_agg(c order by c->>'date',c->>'fxid'),'[]'::jsonb) into screen_cards from jsonb_array_elements(e.payload->'cards') c where c->'prediction'<>'null'::jsonb or exists(select 1 from jsonb_array_elements(e.payload->'slips') s cross join lateral jsonb_array_elements(s->'legs') l where l->>'fxid'=c->>'fxid');
 else screen_cards='[]'::jsonb;end if;
 outp=jsonb_build_object('version','matchmind-display/1','edition_id',e.edition_id,'as_of',e.as_of,'expires_at',e.expires_at,'screen',screen,
 'cards',screen_cards,
 'board',case when screen='predictions' then e.payload->'board' else 'null'::jsonb end,
 'records',case when screen='records' then e.payload->'records' else '{"engine":null,"clv":null}'::jsonb end,
 'slips',case when screen='slips' then e.payload->'slips' else '[]'::jsonb end);
 return outp;
end $$;
reset role;
set local role mm_display_materializer;
create or replace function mm_fixture_delivery.materialize() returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare built jsonb;cards jsonb;b jsonb;rec_engine jsonb;rec_clv jsonb;slips jsonb;stamp timestamptz=statement_timestamp();day_utc date=(statement_timestamp() at time zone 'UTC')::date; eid uuid=gen_random_uuid();nc integer;np integer;
begin
 if not mm_fixture_delivery.publisher_allowed() then raise exception 'Scoped publisher required' using errcode='42501';end if;
 select payload into b from public.shared_records where key='board';
 if b is null then raise exception 'Reviewed published board unavailable';end if;
 -- No LIMIT/OFFSET: every required immutable prediction and every board fixture must survive projection.
 select coalesce(jsonb_agg(jsonb_build_object(
  'fxid',f.fxid,'lid',f.lid,'lname',f.lname,'lcountry',f.lcountry,'date',f.date,'time',f.time,'status',f.status,'elapsed',f.elapsed,'home',f.home,'away',f.away,
  'gh',f.gh,'ga',f.ga,'ft_h',f.ft_h,'ft_a',f.ft_a,'ht_h',f.ht_h,'ht_a',f.ht_a,'updated_at',f.updated_at,'provider',f.provider,
  'prediction',case when p.fxid is null then 'null'::jsonb else jsonb_build_object('lid',p.lid,'lname',p.lname,'home',p.home,'away',p.away,'pick',p.pick,'pick_prob',p.pick_prob,'market',p.market,'p_home',p.p_home,'p_draw',p.p_draw,'p_away',p.p_away,'xg_home',p.xg_home,'xg_away',p.xg_away,'kickoff',p.kickoff,'ktime',p.ktime,'made_at',p.made_at,'withheld_at',p.withheld_at,'final_pick',p.final_pick,'build',p.build) end
 ) order by f.fxid),'[]'::jsonb) into cards from public.fixtures f left join public.predictions p on p.fxid=f.fxid
 where f.date::date between day_utc-6 and day_utc+7 or p.fxid is not null or exists(select 1 from jsonb_array_elements(b->'rows') br where br->>'f'=f.fxid::text)
 or exists(select 1 from public.daily_slips s cross join lateral jsonb_array_elements(s.legs) leg where s.day::date between day_utc-31 and day_utc and leg->>'fxid'=f.fxid::text);
 select count(*) into np from public.predictions;
 if np<>(select count(*) from jsonb_array_elements(cards) c where c->'prediction'<>'null'::jsonb) then raise exception 'Unaccounted immutable prediction inventory';end if;
 select jsonb_build_object('key',key,'payload',payload,'build',build,'computed_at',computed_at) into rec_engine from public.shared_records where key='engine';
 select jsonb_build_object('key',key,'payload',payload,'build',build,'computed_at',computed_at) into rec_clv from public.shared_records where key='clv';
 select coalesce(jsonb_agg(jsonb_build_object('day',day,'tier',tier,'odds',odds,'build',build,'step',step,'legs',legs) order by day,tier),'[]'::jsonb) into slips from public.daily_slips where day::date between day_utc-31 and day_utc;
 built=jsonb_build_object('cards',cards,'board',b,'records',jsonb_build_object('engine',rec_engine,'clv',rec_clv),'slips',slips);
 if not mm_fixture_delivery.payload_valid(built) then raise exception 'Incomplete or unsupported presentation inventory';end if;
 nc=jsonb_array_length(cards);
 -- Expiry is a rolling 24 hours from as_of. The old least(...) clipped it to the next UTC
 -- midnight, which gave the 23:17 run a 43-minute edition. This sits exactly on the table's
 -- expires_at<=as_of+interval '24 hours' bound.
 insert into mm_fixture_delivery.editions values(eid,day_utc,stamp,stamp+interval '24 hours','existing-published-record-projection/1',nc,np,built);
 return jsonb_build_object('version','matchmind-display/1','edition_id',eid,'cards',nc,'predictions',np,'as_of',stamp);
end $$;
reset role;
revoke create on schema mm_fixture_delivery from mm_display_reader, mm_display_materializer;
do $$declare bad text;begin
 if current_setting('mm_fixture_delivery.set_reader',true)='1' then execute format('revoke mm_display_reader from %I granted by %I',current_user,current_user);end if;
 if current_setting('mm_fixture_delivery.set_materializer',true)='1' then execute format('revoke mm_display_materializer from %I granted by %I',current_user,current_user);end if;
 if exists(select 1 from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles g on g.oid=a.grantor join pg_roles m on m.oid=a.member where r.rolname in ('mm_display_reader','mm_display_materializer') and g.rolname=current_user and m.rolname=current_user) then raise exception 'An installer-created membership on an owner role was left behind';end if;
 if has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE') or has_schema_privilege('mm_display_materializer','mm_fixture_delivery','CREATE') then raise exception 'Temporary CREATE on the private schema was not given back';end if;
 -- POSTCONDITIONS: only the two bodies moved; owner, ACL, attributes unchanged for all 12.
 select string_agg(a.fn,', ') into bad from mm_pre a left join (
  select (p.pronamespace::regnamespace::text||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')') as fn, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.provolatile, coalesce(p.proconfig::text,'') as cfg, coalesce(p.proacl::text,'') as acl, md5(p.prosrc) as src
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='mm_fixture_delivery' or (n.nspname='public' and p.proname in ('matchmind_display_v1','matchmind_fixture_access_v1','matchmind_publish_display_v1'))) b on b.fn=a.fn
 where b.fn is null or b.owner<>a.owner or b.prosecdef<>a.prosecdef or b.provolatile<>a.provolatile or b.cfg<>a.cfg or b.acl<>a.acl
    or (a.fn not in ('mm_fixture_delivery.display(text)','mm_fixture_delivery.materialize()') and b.src<>a.src)
    or (a.fn='mm_fixture_delivery.display(text)' and b.src<>'0f85fe96b9ed5d269a886b5675516ea6')
    or (a.fn='mm_fixture_delivery.materialize()' and b.src<>'223529aa1b915e96426c26b1c4acb3ff');
 if bad is not null then raise exception 'POSTCONDITION FAILED, rolling back: %',bad;end if;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mm_fixture_delivery')<>9 then raise exception 'POSTCONDITION FAILED: function count changed';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='mm_fixture_delivery' and a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'POSTCONDITION FAILED: a private function is EXECUTE to PUBLIC';end if;
 if exists(select 1 from mm_pre_data d where d.fixtures<>(select count(*) from public.fixtures) or d.predictions<>(select count(*) from public.predictions) or d.editions<>(select count(*) from mm_fixture_delivery.editions)
   or d.editions_md5<>(select md5(coalesce(string_agg(e::text,'|' order by e.edition_id),'')) from mm_fixture_delivery.editions e)
   or d.fixtures_md5<>(select md5(coalesce(string_agg(f::text,'|' order by f.fxid),'')) from public.fixtures f)
   or d.predictions_md5<>(select md5(coalesce(string_agg(p::text,'|' order by p.fxid),'')) from public.predictions p)
   or d.principals_md5<>(select md5(coalesce(string_agg(r::text,'|' order by r.user_id),'')) from mm_fixture_delivery.principals r)) then raise exception 'POSTCONDITION FAILED: data fingerprint changed';end if;
end $$;
notify pgrst,'reload schema';
commit;
