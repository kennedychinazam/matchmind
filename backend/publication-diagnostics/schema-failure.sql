-- Private sidecar only: the existing boolean validator remains authoritative.
create function mm_publication_diagnostics.schema_failure(v jsonb,s jsonb,path text default '$',depth integer default 0) returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare k text;item jsonb;reason jsonb;t text;d text;n numeric;
begin
 if mm_fixture_delivery.schema_valid(v,s,depth) then return null;end if;
 if depth>12 or v is null then return jsonb_build_object('code','SCHEMA_DEPTH_OR_MISSING','path',path);end if;
 if v='null'::jsonb then return jsonb_build_object('code','SCHEMA_NULL','path',path);end if;
 t=s->>'type';
 if t in('string','number','boolean','array','object','map') and jsonb_typeof(v)<>(case when t='map' then 'object' else t end) then return jsonb_build_object('code','SCHEMA_TYPE','path',path);end if;
 if t='string' then
  d=v#>>'{}';
  if length(d)>(s->>'max')::integer then return jsonb_build_object('code','SCHEMA_STRING_LENGTH','path',path);end if;
  if d ~ '[[:cntrl:]]' then return jsonb_build_object('code','SCHEMA_STRING_CONTROL','path',path);end if;
  if s ? 'pattern' and not d ~ (s->>'pattern') then return jsonb_build_object('code','SCHEMA_STRING_PATTERN','path',path);end if;
  if s->>'format'='date' then return jsonb_build_object('code','SCHEMA_DATE','path',path);end if;
  if s->>'format'='timestamp' then return jsonb_build_object('code','SCHEMA_TIMESTAMP','path',path);end if;
 elsif t='number' then
  n=(v#>>'{}')::numeric;
  if n<(s->>'min')::numeric or n>(s->>'max')::numeric then return jsonb_build_object('code','SCHEMA_NUMBER_RANGE','path',path);end if;
  if coalesce((s->>'integer')::boolean,false) and floor(n)<>n then return jsonb_build_object('code','SCHEMA_NUMBER_INTEGER','path',path);end if;
 end if;
 if t='object' and jsonb_typeof(v)='object' then
  for item in select value from jsonb_array_elements(s->'required') loop
   k=item#>>'{}';if not v ? k then return jsonb_build_object('code','SCHEMA_REQUIRED','path',path||'.'||k);end if;
  end loop;
  -- Schema-owned keys only. Unknown payload keys and map keys are never copied.
  for k,item in select key,value from jsonb_each(v) loop
   if not(s->'properties' ? k) then return jsonb_build_object('code','SCHEMA_UNKNOWN_FIELD','path',path);end if;
   reason=mm_publication_diagnostics.schema_failure(item,s->'properties'->k,path||'.'||k,depth+1);if reason is not null then return reason;end if;
  end loop;
 elsif t='array' and jsonb_typeof(v)='array' then
  if jsonb_array_length(v)>coalesce((s->>'max')::integer,1000) or jsonb_array_length(v)<coalesce((s->>'min')::integer,0) then return jsonb_build_object('code','SCHEMA_ARRAY_BOUND','path',path);end if;
  for item in select value from jsonb_array_elements(v) loop
   reason=mm_publication_diagnostics.schema_failure(item,s->'items',path||'[*]',depth+1);if reason is not null then return reason;end if;
  end loop;
 elsif t='map' and jsonb_typeof(v)='object' then
  if (select count(*) from jsonb_object_keys(v))>(s->>'max')::integer then return jsonb_build_object('code','SCHEMA_MAP_BOUND','path',path);end if;
  for k,item in select key,value from jsonb_each(v) loop
   if k in('__proto__','prototype','constructor') or not k ~ (s->>'key') then return jsonb_build_object('code','SCHEMA_MAP_KEY','path',path||'.*');end if;
   reason=mm_publication_diagnostics.schema_failure(item,s->'values',path||'.*',depth+1);if reason is not null then return reason;end if;
  end loop;
 end if;
 return jsonb_build_object('code','SCHEMA_VALUE','path',path);
exception when others then return jsonb_build_object('code','SCHEMA_EXCEPTION','path',left(path,240));
end$$;
