// Offline research adapter; no mutable database reads, application writes or network.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {utcInstant,validatePredictionSnapshot,canonicalHash,LIMITS,epochMicros} from './snapshot-contract.mjs';
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const featureSource=source.slice(source.indexOf('function buildFixtureIndex(){'),source.indexOf('/* THE PHASE-0 PANEL.'));
const extrasSource=source.slice(source.indexOf('const EXTRA_KEYS ='),source.indexOf('/* ══ BUILD 247 — THE LEAGUE READ'));
if(!featureSource.startsWith('function buildFixtureIndex(){') || !extrasSource.startsWith('const EXTRA_KEYS =')) throw Error('existing feature source boundaries unavailable');
const implementationHash=createHash('sha256').update(featureSource+extrasSource).digest('hex');
// Microsecond comparisons avoid rounding a server receipt after issuance down to it.
export const instantMicros=epochMicros;
export const FIXTURE_FIELDS=Object.freeze(['lid','home','away','date','time','status','gh','ga','ht_h','ht_a','ft_h','ft_a','provider','home_logo','away_logo','xg_h','xg_a','gprev_h','gprev_a','poss_h','poss_a','shots_h','shots_a','sot_h','sot_a','sib_h','sib_a','sob_h','sob_a','blocked_h','blocked_a','corners_h','corners_a','fouls_h','fouls_a','yellows_h','yellows_a','reds_h','reds_a','saves_h','saves_a','passacc_h','passacc_a','offsides_h','offsides_a','formation_h','formation_a','passes_h','passes_a','referee','venue_id','season','round','lineup_h','lineup_a','events','inj_h','inj_a']);
function featureContext(leagues) {
 const context=vm.createContext({},{codeGeneration:{strings:false,wasm:false}});
 vm.runInContext('const afState={leagues:'+JSON.stringify(leagues)+'};\n'+featureSource+'\n'+extrasSource,context,{timeout:1000});
 return context;
}
function matchRow(raw,context) {
 context.raw=JSON.stringify(raw);
 const extras=vm.runInContext('providerExtras(JSON.parse(raw))',context,{timeout:1000});
 return {fxid:raw.fxid,home:raw.home,away:raw.away,date:raw.date,time:raw.time,hg:raw.gh??null,ag:raw.ga??null,hth:raw.ht_h??null,hta:raw.ht_a??null,_x:JSON.parse(JSON.stringify(extras))};
}
export function buildAsOfInputs({snapshot,observations}) {
 const s=validatePredictionSnapshot(snapshot),issue=instantMicros(s.issue_time_utc);
 const seen=new Set(),best=new Map(),excluded=[],missing=[];
 for(const o of observations??[]) {
  if(!o?.observation_id || seen.has(o.observation_id)) throw Error('duplicate or missing observation identifier');
  seen.add(o.observation_id);
  let eligible=false,at;
  try {
   at=instantMicros(o.observed_at_utc);
   eligible=o.availability==='observed' && o.feature_schema_version===1 && o.value!==null &&
    instantMicros(o.received_at_utc)===at && at<=issue &&
    (!o.effective_at_utc || instantMicros(o.effective_at_utc)<=issue) &&
    (!o.played_at_utc || instantMicros(o.played_at_utc)<at && instantMicros(o.played_at_utc)<issue) &&
    FIXTURE_FIELDS.includes(o.field_name);
  }catch{}
  if(!eligible){excluded.push(o.observation_id);continue;}
  const metadata=['lid','home','away','date','time','status','provider','home_logo','away_logo','season','round','referee','venue_id','inj_h','inj_a','lineup_h','lineup_a','formation_h','formation_a'];
  if(String(o.fixture_id)!==s.fixture_id && !metadata.includes(o.field_name) && !o.played_at_utc){excluded.push(o.observation_id);continue;}
  const key=String(o.fixture_id)+':'+o.field_name,prior=best.get(key);
  if(!prior || at>prior.at || at===prior.at && o.observation_id>prior.o.observation_id) best.set(key,{o,at});
 }
 const rows=new Map(),selected=[];
 for(const {o} of best.values()) {
  const id=String(o.fixture_id);
  if(!rows.has(id)) rows.set(id,{fxid:id});
  rows.get(id)[o.field_name]=structuredClone(o.value);
  selected.push({observation_id:o.observation_id,fixture_id:id,field_name:o.field_name,observed_at_utc:o.observed_at_utc,payload_hash:o.payload_hash,source_hash:o.source_hash});
 }
 if(selected.length>LIMITS.evidenceLinks) throw Error('evidence link limit exceeded');
 const target=rows.get(s.fixture_id);
 for(const k of ['home','away','lid','date','time']) if(target?.[k]==null) missing.push(s.fixture_id+':'+k);
 const context=featureContext({}),leagues={};
 let fixture=null;
 for(const raw of rows.values()) {
  if(['home','away','lid','date','time'].some(k=>raw[k]==null)) continue;
  if(typeof raw.home!=='string'||typeof raw.away!=='string'||!Number.isSafeInteger(raw.lid)||typeof raw.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {missing.push(raw.fxid+':identity');continue;}
  const L=leagues[raw.lid]??={id:raw.lid,sport:'football',matches:[],upcoming:[]};
  const m=matchRow(raw,context);
  if(raw.fxid===s.fixture_id){fixture=m;L.upcoming.push(m);continue;}
  if(raw.gh!=null && raw.ga!=null && /^(FINISHED|FT|AET|PEN)$/.test(raw.status??'')) {
   // A scored historical fixture needs archived played-time evidence for both scores.
   const scoreObs=['gh','ga'].map(k=>best.get(raw.fxid+':'+k)?.o);
   if(scoreObs.some(o=>!o?.played_at_utc)){missing.push(raw.fxid+':played_at_utc');continue;}
   if(raw.date>=s.kickoff_at_utc.slice(0,10)) continue;
   L.matches.push(m);
   for(const k of ['xg_h','xg_a','lineup_h','lineup_a']) if(raw[k]==null) missing.push(raw.fxid+':'+k);
  }else L.upcoming.push({...m,hg:null,ag:null});
 }
 for(const L of Object.values(leagues)) L.matches.sort((a,b)=>a.date.localeCompare(b.date)||String(a.fxid).localeCompare(String(b.fxid)));
 const league=target ? leagues[target.lid]??null:null;
 const index={};
 for(const L of Object.values(leagues)) for(const m of [...L.matches,...L.upcoming]) for(const team of [m.home,m.away]) (index[team]??=[]).push({date:m.date,lid:L.id});
 for(const values of Object.values(index)) values.sort((a,b)=>a.date.localeCompare(b.date));
 if(!league?.matches.length) missing.push('history');
 const manifest={implementation_hash:implementationHash,hash_scheme:'canonical-json-v1',selected:selected.sort((a,b)=>a.observation_id.localeCompare(b.observation_id)),excluded,baseline_replay:'incomplete',baseline_replay_reason:'original ordered engine inputs/configuration were not captured by Build 355'};
 manifest.hash=canonicalHash(manifest);
 return {league,fixture,index,leagues,manifest,missing:[...new Set(missing)]};
}
export function existingMatchFeatures(inputs) {
 if(!inputs.league||!inputs.fixture) return null;
 const context=featureContext(inputs.leagues);
 context.input=JSON.stringify({L:inputs.league,f:inputs.fixture,idx:inputs.index});
 const value=vm.runInContext('(()=>{const x=JSON.parse(input);return matchFeatures(x.L,x.f,x.L.matches.length,x.idx)})()',context,{timeout:1000});
 return JSON.parse(JSON.stringify(value));
}
