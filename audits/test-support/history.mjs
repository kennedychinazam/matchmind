import {createHash,randomUUID} from 'node:crypto';
import {literal} from './local-db.mjs';
export function realisticHistory() {
 const teams=['Arsenal','Liverpool',...Array.from({length:14},(_,i)=>`Team ${i+2}`)];
 const rows=[];let fxid=1000;
 for(const lid of [39,40]) for(const season of lid===39?[2022,2023,2024,2025,2026]:[2026]) {
  let round=0;
  for(let leg=0;leg<2;leg++) for(let h=0;h<16;h++) for(let a=0;a<16;a++) {
   if(h===a||leg===1)continue;
   const date=new Date(Date.UTC(season,season===2026?7:3,1+Math.floor(round++/8)*2)).toISOString().slice(0,10);
   rows.push({fxid:String(fxid++),lid,home:teams[h],away:teams[a],date,time:'18:00',status:'FINISHED',gh:(h+a)%4,ga:a%3,ht_h:0,ht_a:0,season,round:'Regular Season - 1',referee:`Ref ${round%4}`,xg_h:1.4,xg_a:1.1,poss_h:55,poss_a:45,shots_h:12,shots_a:8,sib_h:8,sib_a:4,sob_h:4,sob_a:4,gprev_h:.1,gprev_a:.2,passacc_h:82,passacc_a:79,formation_h:'4-3-3',formation_a:'4-3-3',home_logo:`https://synthetic.test/teams/${h+1}.png`,away_logo:`https://synthetic.test/teams/${a+1}.png`,events:[{m:20,team:h+1,type:'Card',detail:'Yellow Card'},{m:30,team:a+1,type:'Goal',detail:'Penalty',pid:3,aid:4}],lineup_h:{coachId:h+1,xi:[{id:h+1,pos:'G'},{id:100+h,pos:'D'}]},lineup_a:{coachId:a+1,xi:[{id:a+1,pos:'G'},{id:100+a,pos:'D'}]},inj_h:'',inj_a:''});
  }
 }
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
 rows.push({fxid:'999999',lid:39,home:teams[0],away:teams[1],date,time:'18:00',status:'NS',season:2026,referee:'Ref 0',inj_h:'',inj_a:''});
 rows.push({fxid:'999998',lid:40,home:teams[0],away:teams[1],date:new Date(Date.parse(date+'T00:00:00Z')+2*86400000).toISOString().slice(0,10),time:'18:00',status:'NS',season:2026});
 return rows;
}
function id(key) {const h=createHash('sha256').update(key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export function seedHistory(db,rows) {
 const run=randomUUID(),batch=[];
 function flush(){if(!batch.length)return;db.sql('SET ROLE research_collector;DO $seed$ BEGIN '+Array.from({length:Math.ceil(batch.length/100)},(_,i)=>`PERFORM research.append_observations(${literal(batch.slice(i*100,i*100+100))});`).join('\n')+' END $seed$;');batch.length=0;}
 for(const row of rows) for(const [field,value] of Object.entries(row)) {
  if(field==='fxid')continue;
  batch.push({observation_id:id(row.fxid+':'+field),fixture_id:row.fxid,source_kind:'collector',source_ref:'synthetic-history',collector_run_id:run,field_name:field,value,availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),effective_at_utc:null,played_at_utc:row.status==='FINISHED'?row.date+'T18:00:00Z':null});
  if(batch.length>=2000)flush();
 }
 flush();
}
export function evidenceRows(db,sql='select * from research.observations') {
 return JSON.parse(db.sql(`select json_agg(json_build_object('observation_id',o.observation_id,'fixture_id',o.fixture_id::text,'field_name',o.field_name,'value',o.value,'availability',o.availability,'observed_at_utc',o.observed_at_utc,'received_at_utc',o.received_at_utc,'played_at_utc',o.played_at_utc,'effective_at_utc',o.effective_at_utc,'feature_schema_version',o.feature_schema_version,'payload_hash',o.payload_hash,'source_hash',o.source_hash)) from (${sql}) o`))??[];
}
