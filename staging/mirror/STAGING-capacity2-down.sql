-- STAGING ONLY. Restores the exact payload_valid and publish text replaced by STAGING-capacity2-up.sql.
-- Published editions are immutable and are not touched; an edition already published above the old
-- bounds stays readable until it expires. Roll the JavaScript bounds back FIRST (revert the Option A
-- commit and redeploy), or every following refresh is refused by staging.
begin;
do $$
declare
 fn oid=to_regprocedure('mm_fixture_delivery.payload_valid(jsonb)');
 def text;
 cards constant text=$old$"updated_at","provider","prediction"],"nullable":false},"max":1000}$old$;
 cards_new constant text=$new$"updated_at","provider","prediction"],"nullable":false},"max":1500}$new$;
 bytes constant text=$old$octet_length(v::text)>1048576$old$;
 bytes_new constant text=$new$octet_length(v::text)>2097152$new$;
begin
 if to_regclass('mm_preview_mirror.configuration') is null or to_regclass('mm_preview_mirror.qa_backup') is null then raise exception 'Isolated real-data preview required';end if;
 def=pg_get_functiondef(fn);
 if (length(def)-length(replace(def,cards_new,'')))/length(cards_new)<>1 or (length(def)-length(replace(def,bytes_new,'')))/length(bytes_new)<>1 then raise exception 'STAGING-capacity2-up.sql is not installed; nothing to roll back';end if;
 execute replace(replace(def,cards_new,cards),bytes_new,bytes);
 def=pg_get_functiondef(fn);
 if position(cards in def)=0 or position(bytes in def)=0 or position(cards_new in def)>0 or position(bytes_new in def)>0 then raise exception 'Rollback not installed';end if;
end$$;
set local role mm_preview_mirror_owner;
do $$
declare
 fn oid=to_regprocedure('mm_preview_mirror.publish(jsonb)');
 def text;
 wire constant text=$old$octet_length(wire)>1048576$old$;
 wire_new constant text=$new$octet_length(wire)>2097152$new$;
begin
 def=pg_get_functiondef(fn);
 if (length(def)-length(replace(def,wire_new,'')))/length(wire_new)<>1 then raise exception 'STAGING-capacity2-up.sql is not installed; nothing to roll back';end if;
 execute replace(def,wire_new,wire);
 if position(wire in pg_get_functiondef(fn))=0 then raise exception 'Rollback not installed';end if;
end$$;
commit;
