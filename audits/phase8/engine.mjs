// Private research execution only. This module never imports the production robot,
// collector, provider SDK or a signed-in browser profile. Packet authentication and
// database receipt provenance belong to the private ingestion boundary, not JSON.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {canonicalHash,canonicalJSON,epochMicros,utcInstant} from '../lib/snapshot-contract.mjs';

export const ENGINE_SOURCE_SHA256='c915f9820c363786f4848ba6ba0f935a100a03f4507505c3b3bf029357e29b10';
const SOURCE_URL=new URL('../../index.html',import.meta.url);
const ORIGIN='http://phase8-engine.test/';
function pinnedSource(){
 const html=readFileSync(SOURCE_URL,'utf8');
 if(createHash('sha256').update(html).digest('hex')!==ENGINE_SOURCE_SHA256)throw Error('Build 355 source identity changed');
 return html;
}
// Export the actual loader population for the private read-only source exporter.
// This is an immutable parsed literal, never evaluation of caller-supplied code.
export const ENGINE_COMP_IDS=Object.freeze(JSON.parse(pinnedSource().match(/const COMP_IDS = (\[[^;]+\]);/)[1]));
const COMP_SCOPE=new Set(ENGINE_COMP_IDS);
const finished=r=>['FT','AET','PEN','FINISHED'].includes(String(r.status).trim().toUpperCase());
const positiveID=v=>Number.isSafeInteger(v)&&v>0;
const text=v=>typeof v==='string'&&v.trim().length>0;
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('invalid fixture date');utcInstant(value+'T00:00:00Z');return value;}
// Only admission checks use this parser. The actual engine/window decisions below
// call the unmodified application's kickoffUTC and tooFarAheadToPublish functions.
function kickoff(r){
 const raw=String(r.time??'').trim();
 const stamp=raw.match(/(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
 const hm=stamp??raw.match(/^(\d{1,2}):(\d{2})/);
 if(!hm)return null;
 return utcInstant((stamp?stamp[1]:r.date)+'T'+String(stamp?stamp[2]:hm[1]).padStart(2,'0')+':'+(stamp?stamp[3]:hm[2])+':00Z');
}
function validatePacket(packet,now){
 // Reject non-JSON inputs rather than silently dropping invalid values in the
 // browser transport. No arbitrary row limit or history truncation is applied.
 canonicalJSON(packet);
 const cutoffDate=new Date(now);cutoffDate.setUTCMonth(cutoffDate.getUTCMonth()-60);
 const historyCutoff=cutoffDate.toISOString().slice(0,10);
 if(packet?.schema_version!==1||packet.history_complete!==true||packet.history_cutoff!==historyCutoff)throw Error('complete schema 1 history at the actual 60-month application cutoff required');
 if(!Array.isArray(packet.scope_competition_ids)||packet.scope_competition_ids.length!==ENGINE_COMP_IDS.length||new Set(packet.scope_competition_ids).size!==ENGINE_COMP_IDS.length||packet.scope_competition_ids.some(id=>!COMP_SCOPE.has(id)))throw Error('complete Build 355 competition scope required');
 if(!Array.isArray(packet.rows)||!packet.rows.length||!Array.isArray(packet.measures)||!Array.isArray(packet.targets)||!packet.targets.length)throw Error('rows, measures and target roster required');
 const receipt=epochMicros(packet.receipt_at_utc),read=epochMicros(packet.source_read_at_utc),issue=epochMicros(now);
 if(read>receipt||receipt>issue)throw Error('source read/receipt must precede generation');
 const ids=new Map(),comps=new Set(),competitionRows=Object.fromEntries(ENGINE_COMP_IDS.map(id=>[id,0]));let histories=0,previous=null;
 for(const r of packet.rows){
  if(!r||!positiveID(r.fxid)||!positiveID(r.lid)||!text(r.home)||!text(r.away)||!text(r.status))throw Error('invalid fixture identity');
  if(!COMP_SCOPE.has(r.lid))throw Error('fixture outside Build 355 loader competition scope');
  date(r.date);if(r.date<historyCutoff)throw Error('fixture precedes declared history cutoff');
  if(ids.has(r.fxid))throw Error('duplicate fixture identity');
  if(previous&&(r.date<previous.date||r.date===previous.date&&r.fxid<=previous.fxid))throw Error('rows must be ordered by date and numeric fxid');
  for(const k of ['gh','ga','ft_h','ft_a','ht_h','ht_a'])if(r[k]!=null&&(!Number.isSafeInteger(r[k])||r[k]<0))throw Error('invalid score field');
  if(finished(r)){
   if(r.gh==null||r.ga==null)throw Error('settled history lacks complete scores');
   const played=kickoff(r);
   if(r.date>utcInstant(packet.receipt_at_utc).slice(0,10)||played&&epochMicros(played)>=receipt)throw Error('future-played history is unavailable at receipt');
   histories++;
  }
  ids.set(r.fxid,r);comps.add(r.lid);competitionRows[r.lid]++;previous=r;
 }
 if(!packet.inventory||packet.inventory.row_count!==packet.rows.length||packet.inventory.competition_count!==comps.size||packet.inventory.history_count!==histories)throw Error('source inventory mismatch');
 if(!packet.inventory.competition_rows||canonicalJSON(packet.inventory.competition_rows)!==canonicalJSON(competitionRows))throw Error('complete per-competition source inventory required, including zero rows');
 const targets=new Set();
 for(const id of packet.targets){
  const r=ids.get(id);if(!positiveID(id)||targets.has(id)||!r)throw Error('invalid or duplicate target');targets.add(id);
  // Started/status-changed/untimed roster entries are retained as explicit failed
  // attempts in the result; they never prevent the remaining fixtures running.
  kickoff(r);
 }
 const measured=new Set();
 for(const m of packet.measures){
  if(!m||!positiveID(m.lid)||measured.has(m.lid))throw Error('invalid or duplicate shared measure');measured.add(m.lid);
  if(m.computed_at&&epochMicros(m.computed_at)>read)throw Error('shared measure postdates source read');
  if(m.gate?.ready){
   if(typeof m.gate.bar!=='number'||!Number.isFinite(m.gate.bar)||m.gate.bar<=0||m.gate.bar>1||typeof m.gate.edgeFloor!=='number'||!Number.isFinite(m.gate.edgeFloor)||m.gate.edgeFloor<0||m.gate.edgeFloor>1)throw Error('invalid captured gate');
  }
 }
 if(packet.contexts!=null){
  if(Object.getPrototypeOf(packet.contexts)!==Object.prototype)throw Error('invalid context map');
  for(const [id,c] of Object.entries(packet.contexts)){
   if(!targets.has(Number(id))||!c||typeof c.hm!=='number'||!Number.isFinite(c.hm)||c.hm<0.85||c.hm>1.15||typeof c.am!=='number'||!Number.isFinite(c.am)||c.am<0.85||c.am>1.15)throw Error('invalid capped context multipliers');
  }
 }
 return structuredClone(packet);
}

/**
 * Run the unchanged Build 355 application in an ephemeral offline Chromium.
 * Rows use public.fixtures flat fields and an explicit date/fxid order; equal-date
 * order in historical live caches was ambiguous, so this ordering is recorded,
 * not represented as reconstruction of a past publication's exact input array.
 * originals is returned separately and is NEVER installed into the scratch archive.
 * nowUtc is solely for explicitly synthetic tests; ordinary calls use real time.
 */
export async function runEngine(packet,{nowUtc}={}){
 const synthetic=nowUtc!==undefined;
 const admissionTime=synthetic?utcInstant(nowUtc):new Date().toISOString();
 const p=validatePacket(packet,admissionTime),inputHash=canonicalHash(p);
 const html=pinnedSource();
 const blocked=[];
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
 try{
  const context=await browser.newContext({serviceWorkers:'block',timezoneId:'UTC'});
  await context.route('**/*',async route=>{
   if(route.request().url()===ORIGIN&&route.request().resourceType()==='document')return route.fulfill({status:200,contentType:'text/html',body:html});
   blocked.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  if(synthetic){await page.clock.install({time:new Date(admissionTime)});await page.clock.pauseAt(new Date(admissionTime));}
  await page.goto(ORIGIN,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof footballEngine==='object'&&typeof applyGatePass==='function');
  const output=await page.evaluate(packet=>{
   if(APP_BUILD!==355||PUBLISH_AHEAD_DAYS!==3||VOID_AFTER_HOURS!==48)throw Error('unexpected engine settings');
   if(cacheCutoff()!==packet.history_cutoff)throw Error('captured history cutoff differs from actual application cutoff');
   // Sole substitutions are persistence boundaries. Model, ladder, gate, context,
   // settlement, provider extras and board capture functions remain unmodified.
   supa=null;authUser=null;
   recordPick=()=>{};archivePrediction=()=>{};recordDrift=()=>{};markWithheld=()=>{};
   Object.assign(afState,{leagues:{},leagueOrder:[],gate:{},skill:{},archive:{},record:[]});
   _boardRecord={state:'pending',payload:null};_measuresState='loaded';
   for(const key of Object.keys(SHARED_MEASURES))delete SHARED_MEASURES[key];
   const selected=new Set(packet.targets);
   for(const r of packet.rows){
    const L=afState.leagues[r.lid]??={id:r.lid,name:r.lname||'',country:r.lcountry||'',flag:'',logo:r.llogo||'',sport:'football',season:r.season,matches:[],upcoming:[],teamIds:{},scorerText:''};
    const fin=isFin(r.status)&&r.gh!=null&&r.ga!=null;
    if(fin){
     const s=settledRow(r);
     L.matches.push(Object.assign({date:r.date,time:r.time,home:r.home,away:r.away,hg:s.gh,ag:s.ga,hth:r.ht_h,hta:r.ht_a,_x:providerExtras(r)},aetOf(s)));
    }
    // Include every unplayed row. Leagues without upcoming rows remain in state,
    // where historyLeagues() can supply concurrent competition evidence.
    if(canonStatus(r.status)==='NS'||selected.has(r.fxid))L.upcoming.push({fxid:r.fxid,date:r.date,time:r.time,home:r.home,away:r.away,season:r.season,_fin:fin,_x:providerExtras(r),_packetStatus:canonStatus(r.status)});
   }
   afState.leagueOrder=Object.keys(afState.leagues).map(Number).sort((a,b)=>a-b);
   for(const m of packet.measures){SHARED_MEASURES[String(m.lid)]=m;if(m.gate?.ready)afState.gate[String(m.lid)]=m.gate;if(m.skill)afState.skill[String(m.lid)]=m.skill;}
   for(const L of Object.values(afState.leagues))registerLeagueDampen(L);
   const found=new Map();
   for(const id of afState.leagueOrder){
    const L=afState.leagues[id],targets=L.upcoming.filter(f=>selected.has(f.fxid));
    const priceable=[];
    for(const f of targets){
     const k=kickoffUTC(f.date,f.time);
     const reason=!k?'target_kickoff_unavailable':Date.now()>=k.getTime()||Date.parse(packet.receipt_at_utc)>=k.getTime()?'target_already_started':f._packetStatus!=='NS'?'target_not_unplayed':null;
     if(reason){found.set(f.fxid,{fixture_id:String(f.fxid),lid:L.id,home:f.home,away:f.away,kickoff_at_utc:k?k.toISOString():null,prediction:null,probabilities:null,decision:null,status:'failed',eligible:false,exclusion_reason:reason});}
     else priceable.push(f);
    }
    // Source orchestration handles all selection, newcomer and gate branches.
    applyGatePass(L,priceable);
    for(const f of priceable){
     const k=kickoffUTC(f.date,f.time);
     const P=fxPredict(L,f),decision=f.calc||null,tmp=Object.create(footballEngine);tmp.matches=L.matches;
     const reason=!predictsComp(L)?'outofscope':!P?'insufficient_history':tooFarAheadToPublish(f)?'outside_72_hour_window':decision?.gated||(!decision?.pick?'no_selection':null);
     const out={fixture_id:String(f.fxid),lid:L.id,home:f.home,away:f.away,kickoff_at_utc:k.toISOString(),prediction:P,probabilities:P?[P.pW,P.pD,P.pL]:null,decision,
      status:P?'forecast':'failed',eligible:!reason,exclusion_reason:reason,shrink_k:tmp.shrinkK(),dampen:tmp.dampenFor()};
     const c=packet.contexts?.[String(f.fxid)];
     if(c&&P){
      const adjusted=c.hm===1&&c.am===1?P:applyContextToPrediction(L,P,c.hm,c.am);
      out.a1={...aiShadowA1(L,f,P,c.hm,c.am),prediction:adjusted};
     }
     found.set(f.fxid,out);
    }
   }
   const generated=new Date().toISOString();
   const predictions=packet.targets.map(id=>{
    const out=found.get(id);if(!out)throw Error('target not hydrated');
    if(out.status!=='failed'&&Date.parse(generated)>=Date.parse(out.kickoff_at_utc)){
     Object.assign(out,{status:'failed',eligible:false,exclusion_reason:'target_already_started',prediction:null,probabilities:null,decision:null});delete out.a1;
    }
    return {...out,generated_at_utc:generated};
   });
   return {generated_at_utc:generated,predictions,settings:{publish_ahead_days:PUBLISH_AHEAD_DAYS,void_after_hours:VOID_AFTER_HOURS,history_cutoff:packet.history_cutoff,order:'date_asc_fxid_numeric_asc',league_order:afState.leagueOrder}};
  },p);
  return {schema_version:1,build:355,source_sha256:ENGINE_SOURCE_SHA256,input_hash:inputHash,synthetic_clock:synthetic,...output,originals:structuredClone(p.originals??[]),
   network:{outbound_requests:0,blocked_requests:blocked}};
 }finally{await browser.close();}
}
