-- STAGING UI rollback; retains immutable editions and additive schema. No source writes.
-- V1 permanently strips analysis; V2 now also serves the original closed shape.
begin;
do $$begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
end$$;
create or replace function public.mm_preview_display_v2(screen text) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select public.mm_preview_display_v1(screen)$$;
commit;
