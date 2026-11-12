-- Authorized target ONLY: rdcbnvfnxenrpnnwxszs. This does not install prospective settlement.
begin;
do $$begin
 if coalesce(current_setting('mm.preview_token_sha256',true),'') !~ '^[a-f0-9]{64}$' then raise exception 'Protected writer configuration required before installation';end if;
 if to_regclass('mm_fixture_delivery.editions') is null or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='fixtures' and column_name='provider_blob') then
  raise exception 'Expected isolated synthetic staging schema missing';end if;
end$$;
lock table public.fixtures,public.predictions,public.shared_records,public.daily_slips,mm_fixture_delivery.editions in share mode;
create role mm_preview_mirror_owner nologin noinherit nosuperuser nobypassrls;
create schema mm_preview_mirror authorization mm_preview_mirror_owner;
revoke all on schema mm_preview_mirror from public,anon,authenticated,service_role;
create table mm_preview_mirror.qa_backup(
 relation_name text primary key,snapshot jsonb not null,row_count int not null,fingerprint text not null,
 verified boolean not null default false,backed_up_at timestamptz not null default statement_timestamp()
);
alter table mm_preview_mirror.qa_backup enable row level security;
-- Verify a full round-trip through each original table type using temporary tables. No source table is changed.
do $$declare relation text; doc jsonb; restored jsonb;begin
 foreach relation in array array['public.fixtures','public.predictions','public.shared_records','public.daily_slips','mm_fixture_delivery.editions'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from %s t',relation) into doc;
  insert into mm_preview_mirror.qa_backup(relation_name,snapshot,row_count,fingerprint) values(relation,doc,jsonb_array_length(doc),md5(doc::text));
  execute format('create temp table mm_restore_check (like %s including defaults) on commit drop',relation);
  execute format('insert into mm_restore_check select * from jsonb_populate_recordset(null::%s,$1)',relation) using doc;
  select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) into restored from mm_restore_check t;
  if restored<>doc or md5(restored::text)<>md5(doc::text) then raise exception 'Staging backup round-trip failed';end if;
  update mm_preview_mirror.qa_backup set verified=true where relation_name=relation;
  drop table mm_restore_check;
 end loop;
end$$;
grant select on mm_preview_mirror.qa_backup to mm_preview_mirror_owner;
create policy backup_reader on mm_preview_mirror.qa_backup for select to mm_preview_mirror_owner using(true);
set role mm_preview_mirror_owner;
create table mm_preview_mirror.configuration(id boolean primary key default true check(id),enabled boolean not null default true,token_sha256 bytea);
insert into mm_preview_mirror.configuration(id,token_sha256) values(true,decode(current_setting('mm.preview_token_sha256'),'hex'));
create table mm_preview_mirror.editions(
 edition_id uuid primary key default gen_random_uuid(),payload jsonb not null,manifest jsonb not null,
 as_of timestamptz not null default statement_timestamp(),expires_at timestamptz not null default statement_timestamp()+interval '24 hours'
);
alter table mm_preview_mirror.configuration enable row level security;
alter table mm_preview_mirror.editions enable row level security;
create function mm_preview_mirror.publish(document jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare token text; wire text=document->>'payload_text';p jsonb;sha text;eid uuid;stamp timestamptz;nc int;np int;d date=(statement_timestamp() at time zone 'UTC')::date;
begin
 token=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-mm-preview-token','');
 if not exists(select 1 from mm_preview_mirror.configuration where token_sha256 is not null and length(token)>=32 and token_sha256=sha256(convert_to(token,'UTF8'))) then raise exception 'Scoped staging mirror writer required' using errcode='42501';end if;
 if not(select enabled from mm_preview_mirror.configuration) then raise exception 'Mirror disabled';end if;
 if not (select count(*)=5 and bool_and(verified) from mm_preview_mirror.qa_backup) then raise exception 'Verified QA backup required';end if;
 if (select array_agg(k order by k) from jsonb_object_keys(document) k) is distinct from array['captured_at','cards','latest_source_update','payload_sha256','payload_text','predictions','source_project','version','window_cards','window_from','window_to'] then raise exception 'Unapproved refresh manifest';end if;
 if document->>'version' is distinct from 'matchmind-real-mirror/1' or document->>'source_project' is distinct from 'toqfdrcjzwnlydqekude' or (document->>'window_from')::date is distinct from d-6 or (document->>'window_to')::date is distinct from d+7 then raise exception 'Unapproved source/window';end if;
 if document->>'captured_at' is null or (document->>'captured_at')::timestamptz>statement_timestamp()+interval '2 minutes' or (document->>'captured_at')::timestamptz<statement_timestamp()-interval '15 minutes' then raise exception 'Refresh snapshot stale';end if;
 if wire is null or octet_length(wire)>524288 then raise exception 'Refresh payload exceeds bound';end if;
 sha=encode(sha256(convert_to(wire,'UTF8')),'hex');
 if sha is distinct from document->>'payload_sha256' then raise exception 'Source checksum mismatch';end if;
 p=wire::jsonb;
 if not mm_fixture_delivery.payload_valid(p) then raise exception 'Closed public payload validation failed';end if;
 nc=jsonb_array_length(p->'cards');np=mm_fixture_delivery.prediction_count(p);
 if nc=0 or nc is distinct from (document->>'cards')::int or np is distinct from (document->>'predictions')::int or
 (select count(*) from jsonb_array_elements(p->'cards') c where(c->>'date')::date between d-6 and d+7) is distinct from (document->>'window_cards')::int then raise exception 'Source/destination coverage mismatch';end if;
 if exists(select 1 from jsonb_array_elements(p->'cards') c where c->>'provider' is distinct from 'af' or c->>'home' ~* '^(QA|Synthetic)\y' or c->>'away' ~* '^(QA|Synthetic)\y' or c->>'lname' ~* 'synthetic') then raise exception 'Non-public or QA fixture refused';end if;
 if exists(select 1 from jsonb_array_elements(p->'cards') c where(c->>'date')::date not between d-6 and d+7
 and not exists(select 1 from jsonb_array_elements(p->'board'->'rows') b where b->>'f'=c->>'fxid')
 and not exists(select 1 from jsonb_array_elements(p->'slips') s cross join lateral jsonb_array_elements(s->'legs') l where l->>'fxid'=c->>'fxid')) then raise exception 'Unreferenced historical source row';end if;
 if exists(select 1 from jsonb_array_elements(p->'cards') c where c->'prediction'<>'null'::jsonb and
 (c->'prediction'->>'made_at' is null or (c->'prediction'->>'made_at')::timestamptz>(document->>'captured_at')::timestamptz or (c->'prediction'->>'build')::int<62 or c->'prediction'->>'pick' is null)) then raise exception 'Unpublished prediction refused';end if;
 if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date<>d) then raise exception 'Only current issued slips admitted';end if;
 insert into mm_preview_mirror.editions(payload,manifest) values(p,document-'payload_text') returning edition_id,as_of into eid,stamp;
 return jsonb_build_object('edition_id',eid,'published_at',stamp,'cards',nc,'predictions',np,'payload_sha256',sha);
end$$;
create function mm_preview_mirror.display(screen text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare e mm_preview_mirror.editions%rowtype;cards jsonb;d date=(statement_timestamp() at time zone 'UTC')::date;
begin
 if screen not in ('scores','predictions','history','records','slips') or screen is null then raise exception 'Unsupported preview screen';end if;
 select * into e from mm_preview_mirror.editions where (select enabled from mm_preview_mirror.configuration) and as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
 if not found then raise exception 'Verified real-data mirror unavailable' using errcode='P0002';end if;
 if screen='scores' then select coalesce(jsonb_agg(jsonb_set(c,'{prediction}','null') order by c->>'date',c->>'fxid'),'[]') into cards from jsonb_array_elements(e.payload->'cards') c where(c->>'date')::date between d-6 and d+7;
 elsif screen='predictions' then select coalesce(jsonb_agg(c order by c->>'date',c->>'fxid'),'[]') into cards from jsonb_array_elements(e.payload->'cards') c where(c->>'date')::date between d-1 and d+7 or exists(select 1 from jsonb_array_elements(e.payload->'board'->'rows') b where b->>'f'=c->>'fxid');
 elsif screen='history' then select coalesce(jsonb_agg(c order by c->>'date',c->>'fxid'),'[]') into cards from jsonb_array_elements(e.payload->'cards') c where c->'prediction'<>'null'::jsonb or exists(select 1 from jsonb_array_elements(e.payload->'slips') s cross join lateral jsonb_array_elements(s->'legs') l where l->>'fxid'=c->>'fxid');
 else cards='[]';end if;
 return jsonb_build_object('version','matchmind-display/1','edition_id',e.edition_id,'as_of',e.as_of,'expires_at',e.expires_at,'screen',screen,'cards',cards,
 'board',case when screen='predictions' then e.payload->'board' else 'null'::jsonb end,'records',case when screen='records' then e.payload->'records' else '{"engine":null,"clv":null}'::jsonb end,'slips',case when screen='slips' then e.payload->'slips' else '[]'::jsonb end);
end$$;
create function mm_preview_mirror.status() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('mode','real-read-only','edition_id',edition_id,'published_at',as_of,'expires_at',expires_at,'captured_at',manifest->>'captured_at','source_updated_at',manifest->>'latest_source_update','cards',manifest->'cards','predictions',manifest->'predictions','payload_sha256',manifest->>'payload_sha256')
 from mm_preview_mirror.editions where (select enabled from mm_preview_mirror.configuration) and as_of<=statement_timestamp() and expires_at>statement_timestamp() order by as_of desc,edition_id desc limit 1;
$$;
revoke all on all functions in schema mm_preview_mirror from public,anon,authenticated,service_role;
reset role;
grant usage on schema mm_fixture_delivery to mm_preview_mirror_owner;
grant execute on function mm_fixture_delivery.payload_valid(jsonb),mm_fixture_delivery.schema_valid(jsonb,jsonb,integer),mm_fixture_delivery.prediction_count(jsonb) to mm_preview_mirror_owner;
grant usage on schema mm_preview_mirror to anon,authenticated,service_role;
grant execute on function mm_preview_mirror.publish(jsonb),mm_preview_mirror.display(text),mm_preview_mirror.status() to anon,authenticated,service_role;
create function public.mm_preview_publish_v1(document jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$select mm_preview_mirror.publish(document)$$;
create function public.mm_preview_display_v1(screen text) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select mm_preview_mirror.display(screen)$$;
create function public.mm_preview_status_v1() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select mm_preview_mirror.status()$$;
revoke all on function public.mm_preview_publish_v1(jsonb),public.mm_preview_display_v1(text),public.mm_preview_status_v1() from public;
grant execute on function public.mm_preview_publish_v1(jsonb),public.mm_preview_display_v1(text),public.mm_preview_status_v1() to anon,authenticated,service_role;
commit;
