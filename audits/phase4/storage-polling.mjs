// Bounded synthetic polling: real append/dedup path, no HTTP, no receipt backdating.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {localDatabase,docker,IMAGE,literal} from '../test-support/local-db.mjs';
import {storageSQL} from './storage-metrics.mjs';
const db=localDatabase('storage-polls'),results={fixtures:100,fields_per_fixture:6,polls_after_initial:20,profiles:[],external_requests:0};
const path=process.argv[2]||'/tmp/mm-storage-polls.json';
function fields(i){return {xg_h:1.2,poss_h:52,formation_h:'4-3-3',lineup_h:{coachId:1,xi:Array.from({length:11},(_,k)=>({id:i*100+k,pos:k===0?'G':'D',name:`Synthetic player ${i}-${k}`}))},events:[{m:20,type:'Card',detail:'Yellow Card',pid:1}],inj_h:'Synthetic unavailable player'};}
try{
 docker(['image','inspect',IMAGE]);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 for(const percent of [0,1,10]){
  const name='poll_'+percent;db.sql(`create database ${name} template matchmind_test`);const sql=x=>db.sql(x,name),values=Array.from({length:100},(_,i)=>fields(i));
  const storage=()=>JSON.parse(sql(storageSQL));const initial=storage();
  for(let tick=0;tick<=20;tick++){
   const run=randomUUID(),batch=[];
   for(let i=0;i<100;i++)for(const [j,field]of Object.keys(values[i]).entries()){
    if(tick>0&&(i*6+j+tick*7)%100<percent){
     if(field==='xg_h')values[i][field]=1+tick/10;
     if(field==='poss_h')values[i][field]=40+tick;
     if(field==='formation_h')values[i][field]=tick%2?'4-4-2':'4-3-3';
     if(field==='lineup_h')values[i][field]={...values[i][field],coachId:tick+1};
     if(field==='events')values[i][field]=[{m:20+tick,type:'Card',detail:'Yellow Card',pid:tick+1}];
     if(field==='inj_h')values[i][field]='Synthetic unavailable player '+tick;
    }
    const value=values[i][field];batch.push({observation_id:randomUUID(),fixture_id:String(1000+i),source_kind:'collector',source_ref:'synthetic-poll',collector_run_id:run,field_name:field,value,availability:'observed',feature_schema_version:1,source_hash:createHash('sha256').update(JSON.stringify(value)).digest('hex'),played_at_utc:'2026-01-01T12:00:00Z',effective_at_utc:null});
   }
   sql('set role research_collector;DO $p$BEGIN '+Array.from({length:6},(_,i)=>`perform research.append_observations(${literal(batch.slice(i*100,(i+1)*100))});`).join('')+'END$p$;');
   if(tick===0)results.profiles.push({change_percent:percent,initial,after_first:storage()});
  }
  const profile=results.profiles.at(-1);profile.after_twenty_more=storage();profile.persisted=Number(sql('select count(*)from research.observations'));profile.attempted=12600;profile.mean_tuple_bytes=Number(sql('select avg(pg_column_size(o))from research.observations o'));assert.ok(profile.persisted>=600);
  if(percent===0){assert.equal(profile.persisted,600);assert.deepEqual(profile.after_first,profile.after_twenty_more);}
  writeFileSync(path,JSON.stringify(results,null,2));console.log(JSON.stringify({percent,persisted:profile.persisted,attempted:12600}));db.sql(`drop database ${name}`);
 }
 // Identical prices still create versions when their receipt/id envelope changes.
 const name='odds_poll';db.sql(`create database ${name} template matchmind_test`);const sql=x=>db.sql(x,name);const profile={kind:'constant-prices-new-envelope',initial:JSON.parse(sql(storageSQL))};
 for(let tick=0;tick<=20;tick++){
  const batch=Array.from({length:100},(_,i)=>{const value={id:tick*100+i+1,fxid:String(1000+i),captured_at:new Date().toISOString(),mins_to_kick:120,h:2.1,d:3.5,a:3.8};return {observation_id:randomUUID(),fixture_id:String(1000+i),source_kind:'odds',source_ref:'synthetic-odds',collector_run_id:randomUUID(),field_name:'odds_1x2',value,availability:'observed',feature_schema_version:1,source_hash:createHash('sha256').update(JSON.stringify(value)).digest('hex'),played_at_utc:null,effective_at_utc:null};});
  sql(`set role research_collector;select research.append_observations(${literal(batch)})`);if(tick===0)profile.after_first=JSON.parse(sql(storageSQL));
 }
 profile.after_twenty_more=JSON.parse(sql(storageSQL));profile.persisted=Number(sql('select count(*)from research.observations'));assert.equal(profile.persisted,2100);results.odds=profile;writeFileSync(path,JSON.stringify(results,null,2));db.sql('drop database odds_poll');
}finally{db.close();}
