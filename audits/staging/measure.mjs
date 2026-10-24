// Local synthetic measurements only; no URLs or remote DB credentials accepted.
import {localDatabase} from '../test-support/local-db.mjs';
const db=localDatabase('measure');
try {
 await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-hooks.sql']) db.apply(f);
 function batch(start,enabled) {
  db.sql(`alter table public.predictions ${enabled?'enable':'disable'} trigger research_capture`);
  const result=db.sql(`select clock_timestamp();insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)select x,39,(now()at time zone 'UTC')::date+1,'18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance' from generate_series(${start},${start+99}) x;select clock_timestamp();`).split('\n');
  return Date.parse(result.at(-1))-Date.parse(result[0]);
 }
 const baseline=[],capture=[];for(let i=0;i<5;i++){baseline.push(batch(1000+i*200,false));capture.push(batch(1100+i*200,true));}
 const median=a=>[...a].sort((a,b)=>a-b)[2];
 const size=JSON.parse(db.sql("select json_build_object('snapshots',(select count(*) from research.prediction_snapshots),'envelope_mean_bytes',(select round(avg(octet_length(envelope::text))) from research.prediction_snapshots),'research_total_bytes',(select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'))"));
 console.log(JSON.stringify({...size,baseline_100_rows_ms:baseline,capture_100_rows_ms:capture,median_baseline_ms:median(baseline),median_capture_ms:median(capture),incremental_ms_per_prediction:(median(capture)-median(baseline))/100,raw_insert_overhead_percent:median(baseline)?100*(median(capture)/median(baseline)-1):null,publisher_5_percent_gate:'requires representative Supabase staging publisher workload; raw insert timings are not that workload',production_provider_http_calls:0,production_writes:0},null,2));
} finally {db.close();}
