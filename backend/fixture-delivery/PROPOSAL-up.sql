-- OFFLINE PROPOSAL ONLY. No production installation authorized.
-- Install/revert only after the exact deployed catalog/function inventory and role scopes are reviewed.
-- Existing provider facts and immutable predictions are never changed by this proposal.
begin;
create schema mm_fixture_delivery;
revoke all on schema mm_fixture_delivery from public, anon, authenticated;
create role mm_display_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
-- S1, HOSTED POSTGRESQL 17: OWNING A FUNCTION REQUIRES BEING ABLE TO SET ROLE TO ITS OWNER.
-- Since PostgreSQL 16 a role created by a CREATEROLE non-superuser gives its creator an
-- ADMIN membership with SET FALSE, so `alter function ... owner to mm_display_reader` aborts
-- with 42501 must be able to SET ROLE "mm_display_reader". A superuser install never sees it.
-- Reproduced offline on a non-superuser role-admin before changing anything.
-- Ownership transfer additionally requires CREATE on the schema holding the object.
-- Both are taken as narrowly as possible and given back before commit; see the cleanup block
-- at the end of this file. Nothing is granted to public, anon or authenticated.
do $$begin
 if not pg_catalog.pg_has_role(current_user,'mm_display_reader','SET') then
  begin execute format('grant mm_display_reader to %I with set true',current_user);
  exception when insufficient_privilege then
   raise exception 'Installer % cannot take SET ROLE on mm_display_reader. A role administrator must run this migration',current_user;
  end;
  perform set_config('mm_fixture_delivery.set_reader','1',true);
 end if;
end $$;
grant create on schema mm_fixture_delivery to mm_display_reader;
grant usage on schema mm_fixture_delivery to anon, authenticated, service_role, mm_display_reader;
-- S2, HOSTED SUPABASE: THESE TWO GRANTS DID NOTHING AND ARE GONE.
--   grant usage on schema auth to mm_display_reader;
--   grant execute on function auth.uid() to mm_display_reader;
-- On hosted Supabase the auth schema belongs to supabase_admin and the installing `postgres`
-- holds USAGE without grant option, so both statements emit
--   WARNING:  no privileges were granted for "auth"
-- and grant nothing. Staging then failed at run time with 42501 permission denied for schema
-- auth, inside publisher_allowed(), because a SECURITY DEFINER function runs as its owner and
-- that owner cannot reach auth.uid(). Reproduced offline before changing anything.
-- The fix does NOT ask for access to the auth schema. It reads the request subject from the
-- same verified GUCs hosted auth.uid() reads, through one private helper below.
create table mm_fixture_delivery.principals (
 user_id uuid primary key, scope text not null check(scope in ('publisher','research')),
 enabled boolean not null default false, approved_until timestamptz not null,
 approval_ref text not null check(length(approval_ref) between 1 and 200)
);
create table mm_fixture_delivery.saved_relations(object_oid oid primary key, object_name text not null, object_kind "char" not null, original_rls boolean not null, original_options text[]);
create table mm_fixture_delivery.saved_select_grants(object_oid oid not null, grantee oid not null, column_name text, grantable boolean not null);
create table mm_fixture_delivery.editions (
 edition_id uuid primary key,
 edition_day date not null,
 as_of timestamptz not null,
 expires_at timestamptz not null,
 source_review text not null check(length(source_review) between 1 and 200),
 expected_cards integer not null check(expected_cards between 0 and 1000),
 expected_predictions integer not null check(expected_predictions between 0 and 1000),
 payload jsonb not null,
 check((as_of at time zone 'UTC')::date=edition_day),
 check(expires_at>as_of and expires_at<=as_of+interval '24 hours')
);
revoke all on all tables in schema mm_fixture_delivery from public, anon, authenticated;
grant select on mm_fixture_delivery.principals, mm_fixture_delivery.editions to mm_display_reader;
grant select,insert on mm_fixture_delivery.editions to service_role;
-- Enrollment is intentionally EMPTY. No approval or execution study is created by installation.
alter table mm_fixture_delivery.principals enable row level security;
alter table mm_fixture_delivery.editions enable row level security;
create policy reader_principals on mm_fixture_delivery.principals for select to mm_display_reader using(true);
create policy reader_editions on mm_fixture_delivery.editions for select to mm_display_reader using(true);
create policy service_editions on mm_fixture_delivery.editions for all to service_role using(true) with check(true);
create function mm_fixture_delivery.schema_valid(v jsonb,s jsonb,depth integer default 0) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare k text; item jsonb; t text; n numeric; d text;
begin
 if depth>12 or v is null then return false;end if;
 if v='null'::jsonb then return coalesce((s->>'nullable')::boolean,false);end if;
 t=s->>'type';
 if t='string' then
  if jsonb_typeof(v)<>'string' then return false;end if;d=v#>>'{}';
  if length(d)>(s->>'max')::integer or d ~ '[[:cntrl:]]' then return false;end if;
  if s ? 'pattern' and not d ~ (s->>'pattern') then return false;end if;
  -- SQL boolean operands may be reordered: do not cast ordinary identity text.
  if s->>'format'='date' then
   if to_char(d::date,'YYYY-MM-DD')<>d then return false;end if;
  elsif s->>'format'='timestamp' then
   -- RFC3339 subset with an explicit zone; retain the original text and precision.
   if d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,9})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$' then return false;end if;
   if substring(d,1,4)='0000' or to_char(substring(d,1,10)::date,'YYYY-MM-DD')<>substring(d,1,10) then return false;end if;
   if d::timestamptz is null then return false;end if;
  end if;
  return true;
 elsif t='number' then
  if jsonb_typeof(v)<>'number' then return false;end if;n=(v#>>'{}')::numeric;
  return n>=(s->>'min')::numeric and n<=(s->>'max')::numeric and (not coalesce((s->>'integer')::boolean,false) or floor(n)=n);
 elsif t='boolean' then return jsonb_typeof(v)='boolean';
 elsif t='array' then
  if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>coalesce((s->>'max')::integer,1000) or jsonb_array_length(v)<coalesce((s->>'min')::integer,0) then return false;end if;
  for item in select value from jsonb_array_elements(v) loop if not mm_fixture_delivery.schema_valid(item,s->'items',depth+1) then return false;end if;end loop;return true;
 elsif t in ('object','map') then
  if jsonb_typeof(v)<>'object' then return false;end if;
  if t='map' then
   if (select count(*) from jsonb_object_keys(v))>(s->>'max')::integer then return false;end if;
   for k,item in select key,value from jsonb_each(v) loop
    if k in ('__proto__','prototype','constructor') or not k ~ (s->>'key') or not mm_fixture_delivery.schema_valid(item,s->'values',depth+1) then return false;end if;
   end loop;return true;
  end if;
  for item in select value from jsonb_array_elements(s->'required') loop if not v ? (item#>>'{}') then return false;end if;end loop;
  for k,item in select key,value from jsonb_each(v) loop
   if not(s->'properties' ? k) or not mm_fixture_delivery.schema_valid(item,s->'properties'->k,depth+1) then return false;end if;
  end loop;return true;
 end if;return false;
exception when others then return false;
end $$;
create function mm_fixture_delivery.payload_valid(v jsonb) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare c jsonb;p jsonb;r jsonb;leg jsonb;n integer;z integer;sum_p numeric;
begin
 if octet_length(v::text)>524288 or not mm_fixture_delivery.schema_valid(v,$schema${"type":"object","properties":{"cards":{"type":"array","items":{"type":"object","properties":{"fxid":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"lid":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"lname":{"type":"string","max":160,"nullable":false},"lcountry":{"type":"string","max":100,"nullable":false},"date":{"type":"string","max":10,"nullable":false,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"time":{"type":"string","max":12,"nullable":true},"status":{"type":"string","max":24,"nullable":false},"elapsed":{"type":"number","min":0,"max":200,"nullable":true,"integer":true},"home":{"type":"string","max":160,"nullable":false},"away":{"type":"string","max":160,"nullable":false},"gh":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"ga":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"ft_h":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"ft_a":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"ht_h":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"ht_a":{"type":"number","min":0,"max":100,"nullable":true,"integer":true},"updated_at":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"},"provider":{"type":"string","max":80,"nullable":true},"prediction":{"type":"object","properties":{"lid":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"lname":{"type":"string","max":160,"nullable":false},"home":{"type":"string","max":160,"nullable":false},"away":{"type":"string","max":160,"nullable":false},"pick":{"type":"string","max":160,"nullable":true},"pick_prob":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"market":{"type":"string","max":160,"nullable":true},"p_home":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"p_draw":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"p_away":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"xg_home":{"type":"number","min":0,"max":100,"nullable":true,"integer":false},"xg_away":{"type":"number","min":0,"max":100,"nullable":true,"integer":false},"kickoff":{"type":"string","max":10,"nullable":false,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"ktime":{"type":"string","max":12,"nullable":true},"made_at":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"},"withheld_at":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"},"final_pick":{"type":"string","max":160,"nullable":true},"build":{"type":"number","min":0,"max":1000000,"nullable":false,"integer":true}},"required":["lid","lname","home","away","pick","pick_prob","market","p_home","p_draw","p_away","xg_home","xg_away","kickoff","ktime","made_at","withheld_at","final_pick","build"],"nullable":true}},"required":["fxid","lid","lname","lcountry","date","time","status","elapsed","home","away","gh","ga","ft_h","ft_a","ht_h","ht_a","updated_at","provider","prediction"],"nullable":false},"max":1000},"board":{"type":"object","properties":{"v":{"type":"number","min":1,"max":1,"nullable":false,"integer":true},"ahead":{"type":"number","min":7,"max":7,"nullable":false,"integer":true},"builtAt":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"},"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"notPassed":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"noBars":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"rows":{"type":"array","items":{"type":"object","properties":{"f":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"l":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"n":{"type":"string","max":160,"nullable":false},"d":{"type":"string","max":10,"nullable":false,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"t":{"type":"string","max":12,"nullable":true},"h":{"type":"string","max":160,"nullable":false},"a":{"type":"string","max":160,"nullable":false},"p":{"type":"string","max":160,"nullable":true},"q":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"m":{"type":"string","max":160,"nullable":true},"g":{"type":"string","max":160,"nullable":true},"z":{"type":"boolean"},"pw":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"pd":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"pq":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"xh":{"type":"number","min":0,"max":100,"nullable":true,"integer":false},"xa":{"type":"number","min":0,"max":100,"nullable":true,"integer":false}},"required":["f","l","n","d","t","h","a","p","q","m","g","z","pw","pd","pq","xh","xa"],"nullable":false},"max":1000}},"required":["v","ahead","builtAt","n","notPassed","noBars","rows"],"nullable":true},"records":{"type":"object","properties":{"engine":{"type":"object","properties":{"key":{"type":"string","max":8,"nullable":false},"payload":{"type":"object","properties":{"v":{"type":"number","min":1,"max":1,"nullable":false,"integer":true},"days":{"type":"map","max":5000,"key":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","values":{"type":"map","max":32,"key":"^[A-Za-z0-9 /.+_-]{1,60}$","values":{"type":"array","items":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"min":3,"max":3}}},"total":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"graded":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"withheld":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"excluded":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"pending":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"orphan":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"off":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"ungradeable":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"voidLate":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true}},"required":["v","days","total","graded","withheld","excluded","pending","orphan","off","ungradeable","voidLate"],"nullable":false},"build":{"type":"number","min":0,"max":1000000,"nullable":false,"integer":true},"computed_at":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"}},"required":["key","payload","build","computed_at"],"nullable":true},"clv":{"type":"object","properties":{"key":{"type":"string","max":8,"nullable":false},"payload":{"type":"object","properties":{"v":{"type":"number","min":1,"max":1,"nullable":false,"integer":true},"raw":{"type":"object","properties":{"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"mean":{"type":"number","min":-1000000000,"max":1000000000,"nullable":false,"integer":false},"se":{"type":"number","min":0,"max":1000000000,"nullable":true,"integer":false}},"required":["n","mean","se"],"nullable":true},"devig":{"type":"object","properties":{"n":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"mean":{"type":"number","min":-1000000000,"max":1000000000,"nullable":false,"integer":false},"se":{"type":"number","min":0,"max":1000000000,"nullable":true,"integer":false}},"required":["n","mean","se"],"nullable":true},"beat":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"tie":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"lost":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"from":{"type":"string","max":10,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"to":{"type":"string","max":10,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"}},"required":["v","raw","devig","beat","tie","lost","from","to"],"nullable":false},"build":{"type":"number","min":0,"max":1000000,"nullable":false,"integer":true},"computed_at":{"type":"string","max":40,"nullable":true,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T","format":"timestamp"}},"required":["key","payload","build","computed_at"],"nullable":true}},"required":["engine","clv"],"nullable":false},"slips":{"type":"array","items":{"type":"object","properties":{"day":{"type":"string","max":10,"nullable":false,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"tier":{"type":"string","max":40,"nullable":false},"odds":{"type":"number","min":0,"max":1000000000000,"nullable":false,"integer":false},"build":{"type":"number","min":0,"max":1000000,"nullable":false,"integer":true},"step":{"type":"string","max":80,"nullable":false},"legs":{"type":"array","items":{"type":"object","properties":{"fxid":{"type":"number","min":1,"max":9007199254740991,"nullable":false,"integer":true},"d":{"type":"string","max":10,"nullable":false,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$","format":"date"},"t":{"type":"string","max":12,"nullable":true},"h":{"type":"string","max":160,"nullable":false},"a":{"type":"string","max":160,"nullable":false},"lid":{"type":"number","min":1,"max":9007199254740991,"nullable":true,"integer":true},"code":{"type":"string","max":40,"nullable":false},"market":{"type":"string","max":60,"nullable":false},"p":{"type":"number","min":0,"max":1,"nullable":true,"integer":false},"o":{"type":"number","min":1,"max":1000000,"nullable":true,"integer":false},"tab":{"type":"string","max":30,"nullable":false},"rank":{"type":"number","min":0,"max":1000000000,"nullable":false,"integer":true},"sel":{"type":"string","max":240,"nullable":false}},"required":["fxid","d","h","a","code","p"],"nullable":false},"max":40}},"required":["day","tier","odds","build","step","legs"],"nullable":false},"max":128}},"required":["cards","board","records","slips"],"nullable":false}$schema$::jsonb) then return false;end if;
 if (select count(*)<>count(distinct value->>'fxid') from jsonb_array_elements(v->'cards')) then return false;end if;
 for c in select value from jsonb_array_elements(v->'cards') loop
  p=c->'prediction';if p<>'null'::jsonb then
   select count(*) filter(where value='null'::jsonb),sum(case when value='null'::jsonb then 0 else (value#>>'{}')::numeric end) into z,sum_p from jsonb_array_elements(jsonb_build_array(p->'p_home',p->'p_draw',p->'p_away'));
   if z not in (0,3) or(z=0 and abs(sum_p-1)>0.0002) then return false;end if;
  end if;
 end loop;
 if v->'board'<>'null'::jsonb then
  if (v->'board'->>'n')::integer<>jsonb_array_length(v->'board'->'rows') then return false;end if;
  if (select count(*)<>count(distinct value->>'f') from jsonb_array_elements(v->'board'->'rows')) then return false;end if;
  for r in select value from jsonb_array_elements(v->'board'->'rows') loop
   select value into c from jsonb_array_elements(v->'cards') where value->>'fxid'=r->>'f';if c is null then return false;end if;
   if c->>'lid'<>r->>'l' or c->>'home'<>r->>'h' or c->>'away'<>r->>'a' or c->>'date'<>r->>'d' or c->'time'<>r->'t' then return false;end if;
   select count(*) filter(where value='null'::jsonb),sum(case when value='null'::jsonb then 0 else (value#>>'{}')::numeric end) into z,sum_p from jsonb_array_elements(jsonb_build_array(r->'pw',r->'pd',r->'pq'));
   if z not in(0,3) or(z=0 and abs(sum_p-1)>0.0002) then return false;end if;
  end loop;
 end if;
 for r in select value from jsonb_array_elements(v->'slips') loop
  for leg in select value from jsonb_array_elements(r->'legs') loop
   if not exists(select 1 from jsonb_array_elements(v->'cards') card_ref where card_ref->>'fxid'=leg->>'fxid') then return false;end if;
  end loop;
 end loop;
 if v->'records'->'engine'<>'null'::jsonb and v->'records'->'engine'->>'key'<>'engine' then return false;end if;
 if v->'records'->'clv'<>'null'::jsonb and v->'records'->'clv'->>'key'<>'clv' then return false;end if;
 return true;
exception when others then return false;
end $$;
alter table mm_fixture_delivery.editions add constraint closed_payload check(mm_fixture_delivery.payload_valid(payload));
create function mm_fixture_delivery.prediction_count(v jsonb) returns integer language sql immutable set search_path=pg_catalog as $$select count(*)::integer from jsonb_array_elements(v->'cards') c where c->'prediction'<>'null'::jsonb$$;
alter table mm_fixture_delivery.editions add constraint complete_inventory check(expected_cards=jsonb_array_length(payload->'cards') and expected_predictions=mm_fixture_delivery.prediction_count(payload));
-- Generated replacement below uses an immutable helper because CHECK forbids subqueries.
-- NOTE for acceptance: `principals.scope` is recorded and constrained to publisher|research
-- but is NOT read here, so both scopes receive the same full raw read. That matches the
-- README's statement that enrolled publisher AND research paths retain complete history, so
-- it is recorded rather than changed: narrowing it is a Director decision about intent, not
-- a defect to patch silently. It matters more now than before, because the added permissive
-- policy turns this capability from inert into live.
-- S2 FIX: THE REQUEST SUBJECT, WITHOUT TOUCHING THE AUTH SCHEMA.
-- Reads exactly what the hosted auth.uid() reads - the GUCs PostgREST sets from the JWT it has
-- already verified - so the trust model is the platform's own and is not widened here. Three
-- differences from a bare copy of that expression, all of them narrowing:
--   SECURITY INVOKER, so it adds no definer surface of its own;
--   a malformed request.jwt.claims JSON returns NULL instead of raising inside a capability check;
--   a value that is not a UUID returns NULL instead of raising 22P02.
-- NULL is the safe answer: every caller compares it with = against principals.user_id, which
-- yields NULL and therefore no row, so an absent or malformed subject is refused, never admitted.
-- It takes no argument, so no caller can name a user_id.
create function mm_fixture_delivery.request_uid() returns uuid language plpgsql stable security invoker set search_path=pg_catalog as $$
declare v text;
begin
 v := nullif(current_setting('request.jwt.claim.sub',true),'');
 if v is null then
  begin v := nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub';
  exception when others then v := null; end;
 end if;
 if v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
 return v::uuid;
end $$;
revoke all on function mm_fixture_delivery.request_uid() from public, anon, authenticated;
grant execute on function mm_fixture_delivery.request_uid() to mm_display_reader;   -- the materializer is granted after it is created, below
create function mm_fixture_delivery.raw_allowed() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from mm_fixture_delivery.principals p where p.user_id=mm_fixture_delivery.request_uid() and p.enabled and p.approved_until>statement_timestamp())
$$;
alter function mm_fixture_delivery.raw_allowed() owner to mm_display_reader;
create function mm_fixture_delivery.raw_expiry() returns timestamptz language sql stable security definer set search_path=pg_catalog as $$select least(p.approved_until,statement_timestamp()+interval '60 seconds') from mm_fixture_delivery.principals p where p.user_id=mm_fixture_delivery.request_uid() and p.enabled and p.approved_until>statement_timestamp()$$;
alter function mm_fixture_delivery.raw_expiry() owner to mm_display_reader;
create function public.matchmind_fixture_access_v1() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('version','matchmind-fixture-access/1','raw_allowed',mm_fixture_delivery.raw_allowed(),'expires_at',mm_fixture_delivery.raw_expiry())
$$;
create function mm_fixture_delivery.display(screen text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare e mm_fixture_delivery.editions%rowtype;outp jsonb;screen_cards jsonb;day_utc date=(statement_timestamp() at time zone 'UTC')::date;
begin
 if screen not in ('scores','predictions','history','records','slips') or screen is null then raise exception 'Unsupported display screen' using errcode='22023';end if;
 select * into e from mm_fixture_delivery.editions where edition_day=(statement_timestamp() at time zone 'UTC')::date and as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
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
alter function mm_fixture_delivery.display(text) owner to mm_display_reader;
create function public.matchmind_display_v1(screen text) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select mm_fixture_delivery.display(screen)$$;
revoke all on all functions in schema mm_fixture_delivery from public,anon,authenticated;
revoke all on function public.matchmind_display_v1(text),public.matchmind_fixture_access_v1() from public,anon,authenticated;
grant execute on function mm_fixture_delivery.raw_allowed(),mm_fixture_delivery.raw_expiry(),mm_fixture_delivery.display(text) to anon,authenticated;
grant execute on function public.matchmind_display_v1(text),public.matchmind_fixture_access_v1() to anon,authenticated;
grant execute on function mm_fixture_delivery.schema_valid(jsonb,jsonb,integer),mm_fixture_delivery.payload_valid(jsonb),mm_fixture_delivery.prediction_count(jsonb) to service_role;
-- The reader is a dedicated NONLOGIN NONBYPASSRLS role. It has NO raw-table grants or role memberships.
-- service_role continues to use its existing collector/publisher privileges; this proposal changes no source rows or write policies.
do $$
declare r record;obj regclass;n text;col record;auth_had_select boolean;svc_direct boolean;svc_effective boolean;svc_public boolean;svc_revoked_role text;pre record;
begin
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then raise exception 'Public caller role bypasses RLS';end if;
 foreach n in array array['fixtures','predictions','daily_slips','shared_records','odds_snapshots','injuries','match_context','predictions_retired','match_analysis','venues'] loop
  obj=to_regclass('public.'||quote_ident(n));if obj is null then raise exception 'Required source object missing: %',n;end if;
  if (select relkind from pg_class where oid=obj)<>'r' then raise exception 'Expected base table: %',n;end if;
 end loop;
 foreach n in array array['fixtures_lean','competitions','odds_latest'] loop
  obj=to_regclass('public.'||quote_ident(n));if obj is null then raise exception 'Required source view missing: %',n;end if;
 end loop;
 -- BUILD 357 PREFLIGHT: PROVE THE COLLECTOR SURVIVES THIS MIGRATION, BEFORE ANYTHING IS REVOKED.
 -- Below, this script runs `revoke select on <object> from public,anon,authenticated`. If the
 -- collector's read reached it THROUGH one of those three, that statement silently stops
 -- ingestion, and nothing in the catalogue afterwards says why.
 --
 -- It is driven from THE SAME recursive CTE the revoke loop uses, not from a separate list.
 -- An earlier version checked ten named base tables while the revoke loop reached thirteen roots
 -- plus every dependent view, so three roots and all the views were revoked unchecked. Found by
 -- independent review. Two hand-maintained lists, one for the check and a larger one for the
 -- action, is the shape of that bug, so there is now one list.
 --
 -- It still completes for EVERY object before the first source revoke, which happens in the next
 -- loop. The whole file is one transaction, so any abort rolls all of it back.
 --
 -- It verifies the PROPERTY the migration depends on - an explicit direct SELECT grant to the
 -- collector - rather than any installation's observed configuration, and it NAMES THE REAL
 -- CAUSE when it refuses. aclexplode reports the ACL grantee, which for a group grant is the
 -- group, never the member, so a direct-grant test alone cannot tell PUBLIC from a group the
 -- revoke never touches. Saying 'via PUBLIC' in that second case sends the operator to inspect
 -- the wrong grant, so the three cases are distinguished below.
 if not exists(select 1 from pg_roles where rolname='service_role') then
  raise exception 'Collector role service_role does not exist; review the collector identity before installing';
 end if;
 for pre in with recursive roots as(select c.oid from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname in ('fixtures','fixtures_lean','competitions','predictions','daily_slips','shared_records','odds_snapshots','odds_latest','injuries','match_context','predictions_retired','match_analysis','venues')),
 deps(oid) as(select oid from roots union select rw.ev_class from deps d join pg_depend pd on pd.refobjid=d.oid join pg_rewrite rw on rw.oid=pd.objid where rw.ev_class<>d.oid)
 select distinct c.oid,c.relname,c.relkind from deps d join pg_class c on c.oid=d.oid join pg_namespace ns on ns.oid=c.relnamespace where c.relkind in ('r','v','m') loop
  -- SCOPE. The strict requirement applies to the copied-fact BASE TABLES only.
  -- The independent review was right that one list must drive both the check and the action,
  -- and the traversal above is now that one list. It was wrong of me to also widen the
  -- REQUIREMENT to every object the traversal reaches. The collector reads the base tables; the
  -- views are a public convenience, and in the project's own synthetic fixture the collector
  -- reads fixtures_lean, competitions, odds_latest and provider_alias through the PUBLIC grant
  -- that THIS MIGRATION EXISTS TO REMOVE. Demanding a direct grant on those would refuse to
  -- install on precisely the state the migration is written for. Proven, not reasoned: the
  -- wider version aborted the project's own PostgREST acceptance run on provider_alias.
  -- Residual worth stating: a base table reached only by the recursion, outside the named set,
  -- is revoked without a collector check. None exists today; if one appears it belongs in the
  -- named set and in this check.
  if not(pre.relkind='r' and pre.relname = any(array['fixtures','predictions','daily_slips','shared_records','odds_snapshots','injuries','match_context','predictions_retired','match_analysis','venues'])) then
   continue;
  end if;
  svc_effective = has_table_privilege('service_role',pre.oid,'SELECT');
  svc_direct = exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
                      where c.oid=pre.oid and a.privilege_type='SELECT'
                        and a.grantee=(select oid from pg_roles where rolname='service_role'));
  if not svc_effective then
   raise exception 'Collector cannot read %: service_role has no effective SELECT. Installing would stop ingestion',pre.relname;
  end if;
  if not svc_direct then
   svc_public = exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
                       where c.oid=pre.oid and a.privilege_type='SELECT' and a.grantee=0);
   select r2 into svc_revoked_role from unnest(array['anon','authenticated']) r2
    where exists(select 1 from pg_roles g where g.rolname=r2 and pg_has_role('service_role',g.oid,'USAGE'))
      and has_table_privilege(r2,pre.oid,'SELECT') limit 1;
   if svc_public then
    raise exception 'Collector read on % comes from the PUBLIC grant this migration revokes. Installing would stop ingestion. Run: grant select on public.% to service_role; then re-run',pre.relname,pre.relname;
   elsif svc_revoked_role is not null then
    raise exception 'Collector read on % comes through role %, which this migration revokes from. Installing would stop ingestion. Run: grant select on public.% to service_role; then re-run',pre.relname,svc_revoked_role,pre.relname;
   else
    raise exception 'Collector read on % is inherited through a role this migration does not revoke from, so the read would survive, but there is no explicit grant to service_role and this migration will not install on an unverified privilege shape. Run: grant select on public.% to service_role; then re-run',pre.relname,pre.relname;
   end if;
  end if;
 end loop;
 -- Collect named provider-bearing objects and recursively dependent views, including owner-right aliases.
 for r in with recursive roots as(select c.oid from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname in ('fixtures','fixtures_lean','competitions','predictions','daily_slips','shared_records','odds_snapshots','odds_latest','injuries','match_context','predictions_retired','match_analysis','venues')),
 deps(oid) as(select oid from roots union select rw.ev_class from deps d join pg_depend pd on pd.refobjid=d.oid join pg_rewrite rw on rw.oid=pd.objid where rw.ev_class<>d.oid)
 select distinct c.oid,c.relname,c.relkind,c.relrowsecurity,c.reloptions,ns.nspname from deps d join pg_class c on c.oid=d.oid join pg_namespace ns on ns.oid=c.relnamespace where c.relkind in ('r','v','m') loop
  if r.nspname<>'public' or r.relkind='m' then raise exception 'Unreviewed dependent namespace/object: %.%',r.nspname,r.relname;end if;
  auth_had_select=has_any_column_privilege('authenticated',r.oid,'SELECT');
  insert into mm_fixture_delivery.saved_relations values(r.oid,format('%I.%I',r.nspname,r.relname),r.relkind,r.relrowsecurity,r.reloptions);
  insert into mm_fixture_delivery.saved_select_grants select r.oid,a.grantee,null,a.is_grantable from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=r.oid and a.privilege_type='SELECT' and a.grantee in (0,(select oid from pg_roles where rolname='anon'),(select oid from pg_roles where rolname='authenticated'));
  insert into mm_fixture_delivery.saved_select_grants select r.oid,a.grantee,at.attname,a.is_grantable from pg_attribute at cross join lateral aclexplode(at.attacl) a where at.attrelid=r.oid and at.attnum>0 and a.privilege_type='SELECT' and a.grantee in(0,(select oid from pg_roles where rolname='anon'),(select oid from pg_roles where rolname='authenticated'));
  execute format('revoke select on %I.%I from public,anon,authenticated',r.nspname,r.relname);
  for col in select attname from pg_attribute where attrelid=r.oid and attnum>0 and not attisdropped loop execute format('revoke select(%I) on %I.%I from public,anon,authenticated',col.attname,r.nspname,r.relname);end loop;
  if r.relkind='r' then
   execute format('alter table %I.%I enable row level security',r.nspname,r.relname);
   execute format('grant select on %I.%I to authenticated',r.nspname,r.relname);
   execute format('create policy mm_source_raw_fence on %I.%I as restrictive for select to authenticated using ((select mm_fixture_delivery.raw_allowed()))',r.nspname,r.relname);
   -- A RESTRICTIVE policy cannot return a row on its own: with RLS enabled and no PERMISSIVE
   -- policy that applies, PostgreSQL default-denies, so the capability was inert and an
   -- explicitly enrolled principal read zero rows while raw_allowed() returned true. Proven on
   -- an isolated synthetic cluster; see local-fence-regression.sql. Both policies read the SAME
   -- capability, so the net can never exceed it: an ordinary authenticated caller still reads
   -- nothing, and revocation or expiry closes it on the next statement.
   execute format('create policy mm_source_raw_read on %I.%I for select to authenticated using ((select mm_fixture_delivery.raw_allowed()))',r.nspname,r.relname);
  elsif r.relkind='v' then
   execute format('alter view %I.%I set(security_invoker=true)',r.nspname,r.relname);
   if auth_had_select then execute format('grant select on %I.%I to authenticated',r.nspname,r.relname);end if;
  end if;
  -- Unknown inherited grants are not ours to strip. Abort the whole proposal instead.
  if has_any_column_privilege('anon',r.oid,'SELECT') then raise exception 'Unreviewed inherited anonymous SELECT on %',r.relname;end if;
 end loop;
 -- Fail rather than leave a known privileged SQL/RPC alias around the fence. Dynamic/external bodies need separate reviewed export.
 if exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.prosecdef and p.prosrc ~* '(fixtures|odds_snapshots|shared_records|daily_slips|predictions)' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then
  raise exception 'Review/revoke privileged provider-data RPC before installation';
 end if;
end $$;
-- This materializer is callable only by an explicitly enrolled current publisher.
-- Browser supplies no payload, fixture ID, date, page, count or source-review claim.
create role mm_display_materializer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
-- Same S1 precondition for the second owner role.
do $$begin
 if not pg_catalog.pg_has_role(current_user,'mm_display_materializer','SET') then
  begin execute format('grant mm_display_materializer to %I with set true',current_user);
  exception when insufficient_privilege then
   raise exception 'Installer % cannot take SET ROLE on mm_display_materializer. A role administrator must run this migration',current_user;
  end;
  perform set_config('mm_fixture_delivery.set_materializer','1',true);
 end if;
end $$;
grant create on schema mm_fixture_delivery to mm_display_materializer;
grant execute on function mm_fixture_delivery.request_uid() to mm_display_materializer;
grant usage on schema public,mm_fixture_delivery to mm_display_materializer;
grant select,insert on mm_fixture_delivery.editions to mm_display_materializer;
create policy materializer_editions on mm_fixture_delivery.editions for all to mm_display_materializer using(true) with check(true);
grant select(fxid,lid,lname,lcountry,date,time,status,elapsed,home,away,gh,ga,ft_h,ft_a,ht_h,ht_a,updated_at,provider) on public.fixtures to mm_display_materializer;
grant select(fxid,lid,lname,home,away,pick,pick_prob,market,p_home,p_draw,p_away,xg_home,xg_away,kickoff,ktime,made_at,withheld_at,final_pick,build) on public.predictions to mm_display_materializer;
grant select(key,payload,build,computed_at) on public.shared_records to mm_display_materializer;
grant select(day,tier,odds,build,step,legs) on public.daily_slips to mm_display_materializer;
create policy materializer_read on public.fixtures for select to mm_display_materializer using(true);
create policy materializer_read on public.predictions for select to mm_display_materializer using(true);
create policy materializer_read on public.shared_records for select to mm_display_materializer using(true);
create policy materializer_read on public.daily_slips for select to mm_display_materializer using(true);
create function mm_fixture_delivery.publisher_allowed() returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select current_setting('role',true)='service_role' or exists(select 1 from mm_fixture_delivery.principals where user_id=mm_fixture_delivery.request_uid() and scope='publisher' and enabled and approved_until>statement_timestamp())
$$;
alter function mm_fixture_delivery.publisher_allowed() owner to mm_display_reader;
revoke all on function mm_fixture_delivery.publisher_allowed() from public,anon,authenticated;
grant execute on function mm_fixture_delivery.publisher_allowed() to mm_display_materializer;
grant execute on function mm_fixture_delivery.schema_valid(jsonb,jsonb,integer),mm_fixture_delivery.payload_valid(jsonb),mm_fixture_delivery.prediction_count(jsonb) to mm_display_materializer;
create function mm_fixture_delivery.materialize() returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
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
 insert into mm_fixture_delivery.editions values(eid,day_utc,stamp,least(stamp+interval '24 hours',((day_utc+1)::timestamp at time zone 'UTC')),'existing-published-record-projection/1',nc,np,built);
 return jsonb_build_object('version','matchmind-display/1','edition_id',eid,'cards',nc,'predictions',np,'as_of',stamp);
end $$;
alter function mm_fixture_delivery.materialize() owner to mm_display_materializer;
create function public.matchmind_publish_display_v1() returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_fixture_delivery.materialize()$$;
revoke all on function public.matchmind_publish_display_v1(),mm_fixture_delivery.materialize() from public,anon,authenticated;
grant execute on function public.matchmind_publish_display_v1(),mm_fixture_delivery.materialize() to authenticated,service_role;

-- S1 CLEANUP. Hand back exactly what was taken, before this transaction commits.
-- CREATE on the private schema is removed from both owner roles: they are created by this
-- migration and had none before it, so this restores them to no-CREATE. The installer's
-- SET-role membership is revoked ONLY when this migration added it, and only the SET option
-- is dropped, so an administratively granted membership that was already there is untouched.
-- Note for the reviewer, stated rather than implied: the installer keeps ADMIN on roles it
-- created and could grant itself SET again at will. This is least-privilege hygiene, not a
-- security boundary against whoever already holds the installing role.
revoke create on schema mm_fixture_delivery from mm_display_reader, mm_display_materializer;
do $$begin
 -- Revoke the WHOLE membership this migration created, identified by its grantor, not merely
 -- its SET option. Dropping only SET leaves an empty edge behind, and the edge also carries
 -- an INHERIT option that would hand the installer the owner role's privileges outright.
 -- GRANTED BY current_user names our edge exactly, so the administratively granted edge that
 -- the platform created alongside it is left as it was.
 if current_setting('mm_fixture_delivery.set_reader',true)='1' then
  execute format('revoke mm_display_reader from %I granted by %I',current_user,current_user);
 end if;
 if current_setting('mm_fixture_delivery.set_materializer',true)='1' then
  execute format('revoke mm_display_materializer from %I granted by %I',current_user,current_user);
 end if;
 if exists(select 1 from pg_catalog.pg_auth_members a
           join pg_catalog.pg_roles r on r.oid=a.roleid
           join pg_catalog.pg_roles g on g.oid=a.grantor
           where r.rolname in ('mm_display_reader','mm_display_materializer')
             and g.rolname=current_user) then
  raise exception 'An installer-created membership on an owner role was left behind';
 end if;
 if pg_catalog.has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE')
  or pg_catalog.has_schema_privilege('mm_display_materializer','mm_fixture_delivery','CREATE') then
  raise exception 'Temporary CREATE on the private schema was not given back';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
