-- OFFLINE REVERT PROPOSAL ONLY. Requires explicit approval: restores the old broad exposure.
-- Never delete source fixtures, predictions, personal state, editions, registry or archive records.
begin;
do $$
declare r record;g record;col record;who text;grant_sql text;opt text;
begin
 if to_regclass('mm_fixture_delivery.saved_relations') is null then raise exception 'Original permission snapshot unavailable';end if;
 for r in select * from mm_fixture_delivery.saved_relations loop
  if to_regclass(r.object_name)::oid is distinct from r.object_oid then raise exception 'Relation identity changed: %',r.object_name;end if;
  execute format('revoke select on %s from public,anon,authenticated',r.object_name);
  for col in select attname from pg_attribute where attrelid=r.object_oid and attnum>0 and not attisdropped loop execute format('revoke select(%I) on %s from public,anon,authenticated',col.attname,r.object_name);end loop;
  if r.object_kind='r' then
   execute format('drop policy if exists mm_source_raw_fence on %s',r.object_name);
   execute format('drop policy if exists materializer_read on %s',r.object_name);
   if not r.original_rls then execute format('alter table %s disable row level security',r.object_name);end if;
  elsif r.object_kind='v' then
   select x into opt from unnest(r.original_options) x where x like 'security_invoker=%';
   if opt is null then execute format('alter view %s reset(security_invoker)',r.object_name);
   else execute format('alter view %s set(security_invoker=%s)',r.object_name,split_part(opt,'=',2));end if;
  end if;
 end loop;
 for g in select s.*,sr.object_name from mm_fixture_delivery.saved_select_grants s join mm_fixture_delivery.saved_relations sr using(object_oid) loop
  who=case when g.grantee=0 then 'public' else quote_ident((select rolname from pg_roles where oid=g.grantee)) end;
  if who is null then raise exception 'Original grantee missing';end if;
  grant_sql=case when g.column_name is null then 'select' else format('select(%I)',g.column_name) end;
  execute format('grant %s on %s to %s%s',grant_sql,g.object_name,who,case when g.grantable then ' with grant option' else '' end);
 end loop;
end $$;
revoke all on function public.matchmind_display_v1(text),public.matchmind_fixture_access_v1(),public.matchmind_publish_display_v1() from public,anon,authenticated,service_role;
revoke all on function mm_fixture_delivery.display(text),mm_fixture_delivery.raw_allowed(),mm_fixture_delivery.raw_expiry(),mm_fixture_delivery.materialize() from public,anon,authenticated,service_role;
-- Private metadata/editions and original ACL snapshots are retained for audit; no CASCADE/data deletion.
notify pgrst,'reload schema';
commit;
