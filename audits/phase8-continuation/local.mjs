// Restore-time maintenance ONLY in the inherited network-none Docker database.
import {readFileSync} from 'node:fs';import {repository} from '../phase6/repository.mjs';
export function refreshWriter(db){
 repository(db); // Reject any hosted URL, foreign image, network or port exposure.
 const schema=readFileSync(new URL('../phase8/schema.sql',import.meta.url),'utf8');
 const start=schema.indexOf('CREATE FUNCTION shadow_eval.weekend_append('),end=schema.lastIndexOf('COMMIT;');
 if(start<0||end<start)throw Error('reviewed local writer unavailable');
 const writer=schema.slice(start,end).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 // A Saturday-era checkpoint restores its own narrower kind constraint, which
 // predates 'confirmation'. Refreshing only the writer left it able to validate
 // a mandatory reservation confirmation and still fail on the table CHECK at
 // INSERT, after the reservation hold was already immutable. Widen the
 // constraint from the same reviewed schema text, and prove the maintenance
 // adds, removes and repays nothing.
 const kinds=/CHECK\(kind IN\(([^)]*)\)\)/.exec(schema)?.[1];
 if(!kinds||!kinds.includes("'confirmation'"))throw Error('reviewed local kind constraint unavailable');
 const ledger=()=>db.sql("SELECT count(*)||':'||coalesce(sum((body->>'reserved_micros')::bigint),0)FROM shadow_eval.weekend_events");
 const before=ledger();
 const result=db.sql('BEGIN;SET LOCAL ROLE research_owner;'
  +"DO $do$DECLARE c text;BEGIN SELECT conname INTO c FROM pg_constraint WHERE conrelid='shadow_eval.weekend_events'::regclass AND contype='c' AND pg_get_constraintdef(oid)LIKE '%kind%IN%';IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE shadow_eval.weekend_events DROP CONSTRAINT %I',c);END IF;END$do$;"
  +`ALTER TABLE shadow_eval.weekend_events ADD CONSTRAINT weekend_events_kind_check CHECK(kind IN(${kinds}));`
  +writer+'COMMIT;');
 if(ledger()!==before)throw Error('restore maintenance must not change stored events or retained liability');
 return result;
}
