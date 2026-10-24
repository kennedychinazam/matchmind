// Restore-time maintenance ONLY in the inherited network-none Docker database.
import {readFileSync} from 'node:fs';import {repository} from '../phase6/repository.mjs';
export function refreshWriter(db){
 repository(db); // Reject any hosted URL, foreign image, network or port exposure.
 const schema=readFileSync(new URL('../phase8/schema.sql',import.meta.url),'utf8');
 const start=schema.indexOf('CREATE FUNCTION shadow_eval.weekend_append('),end=schema.lastIndexOf('COMMIT;');
 if(start<0||end<start)throw Error('reviewed local writer unavailable');
 const writer=schema.slice(start,end).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 return db.sql('BEGIN;SET LOCAL ROLE research_owner;'+writer+'COMMIT;');
}
