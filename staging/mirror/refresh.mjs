// Production transport is GET-only, anonymous and fixed-host; only mapped public fields leave the runner.
import {createHash} from 'node:crypto';
import {projectFixtureAnalysis,HISTORY_COLUMNS,HISTORY_DAYS,COMPETITION_COLUMNS,COMPETITION_AHEAD_DAYS,competitionFrom,projectCompetition} from './analysis-projection.mjs';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {CARD_SCHEMA,PAYLOAD_SCHEMA,validatePresentationPayload,legacyPresentationPayload} from '../../backend/fixture-delivery/contract.mjs';
export const SOURCE='https://toqfdrcjzwnlydqekude.supabase.co';
export const TARGET='https://rdcbnvfnxenrpnnwxszs.supabase.co';
const SOURCE_KEY='sb_publishable_wrXk5NFfWkrCdLgiQsaMHg_7lRPeO4-';
const TARGET_KEY='sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
export const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function project(value,schema){
 if(value===null)return null;
 if(schema.type==='array')return value.map(x=>project(x,schema.items));
 if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).filter(([k])=>Object.hasOwn(value,k)).map(([k,s])=>[k,project(value[k],s)]));
 if(schema.type==='map')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,project(v,schema.values)]));
 return value;
}
export function windowFor(now){const d=new Date(now);const day=d.toISOString().slice(0,10);return{from:new Date(Date.parse(day)-6*86400000).toISOString().slice(0,10),to:new Date(Date.parse(day)+7*86400000).toISOString().slice(0,10),day};}
const fixtureCols=Object.keys(CARD_SCHEMA.properties).filter(x=>!['prediction','analysis'].includes(x)).join(',');
const predictionCols=['fxid',...Object.keys(CARD_SCHEMA.properties.prediction.properties)].join(',');
const columnsByTable={fixtures:fixtureCols,predictions:predictionCols,shared_records:'key,payload,build,computed_at',daily_slips:'day,tier,odds,build,step,legs'};
export async function readPages(table,columns,filters,order,fetcher=fetch){
 if(!Object.hasOwn(columnsByTable,table)||!columns||columns.split(',').some(c=>!(table==='fixtures'?new Set((fixtureCols+','+HISTORY_COLUMNS+','+COMPETITION_COLUMNS).split(',')):new Set(columnsByTable[table].split(','))).has(c)))throw Error('Unapproved source reader');
 const rows=[];let total=null;
 for(let offset=0;offset<=1000;offset+=200){
  const u=new URL('/rest/v1/'+table,SOURCE);u.searchParams.set('select',columns);u.searchParams.set('order',order);u.searchParams.set('limit','200');u.searchParams.set('offset',String(offset));
  for(const[k,v]of filters)u.searchParams.append(k,v);
  const r=await fetcher(u,{method:'GET',redirect:'error',headers:{apikey:SOURCE_KEY,Prefer:'count=exact'},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Source '+table+' read HTTP '+r.status);
  const count=Number(r.headers.get('content-range')?.split('/')[1]);
  if(!Number.isInteger(count)||count>1000||(total!==null&&total!==count))throw Error('Source count unavailable, changed or exceeds reviewed bound');
  total=count;const page=await r.json();if(!Array.isArray(page)||page.length>200)throw Error('Source page invalid');rows.push(...page);
  if(rows.length===total)break;
  if(page.length!==200)throw Error('Incomplete source pagination');
 }
 if(rows.length!==total)throw Error('Source inventory incomplete');return rows;
}
/* PREVIOUS-DAY ISSUE. The source read admitted issued slips for the current UTC day only, so from
   00:00 UTC until the day's Tips were issued the mirror carried none. With `previousIssue` the read
   is the current and the previous UTC day: whole rows, in source order, never truncated. It is OFF
   unless MM_MIRROR_PREVIOUS_ISSUE=1, because the installed staging publisher refuses any slip whose
   day is not the current one. Turn it on only after STAGING-tips-continuity-up.sql is installed. */
export const previousIssueEnabled=(env=process.env)=>env.MM_MIRROR_PREVIOUS_ISSUE==='1';
export async function collect(now=new Date(),fetcher=fetch,{previousIssue=previousIssueEnabled()}={}){
 const w=windowFor(now),prior=new Date(Date.parse(w.day)-86400000).toISOString().slice(0,10);
 const [fixtures,slips,records]=await Promise.all([
  readPages('fixtures',fixtureCols,[['provider','eq.af'],['date','gte.'+w.from],['date','lte.'+w.to]],'fxid.asc',fetcher),
  readPages('daily_slips','day,tier,odds,build,step,legs',[previousIssue?['day','in.('+prior+','+w.day+')']:['day','eq.'+w.day]],'day.asc,tier.asc',fetcher),
  readPages('shared_records','key,payload,build,computed_at',[['key','in.(board,engine,clv)']],'key.asc',fetcher)
 ]);
 if(!fixtures.length)throw Error('No genuine fixtures in accepted window');
 const windowCount=fixtures.length,byKey=Object.fromEntries(records.map(x=>[x.key,x]));
 const board=byKey.board?.payload??null;
 const wanted=new Set([...(board?.rows||[]).map(r=>r.f),...slips.flatMap(s=>s.legs.map(l=>l.fxid))]);
 const present=new Set(fixtures.map(f=>f.fxid));const missing=[...wanted].filter(id=>!present.has(id)).sort((a,b)=>a-b);
 for(let i=0;i<missing.length;i+=150){
  fixtures.push(...await readPages('fixtures',fixtureCols,[['provider','eq.af'],['fxid','in.('+missing.slice(i,i+150).join(',')+')']],'fxid.asc',fetcher));
 }
 fixtures.sort((a,b)=>a.fxid-b.fxid);
 if(fixtures.length>1000||new Set(fixtures.map(f=>f.fxid)).size!==fixtures.length||missing.some(id=>!fixtures.some(f=>f.fxid===id)))throw Error('Linked published fixture inventory incomplete or excessive');
 if(fixtures.some(f=>/^(QA\b|Synthetic\b)/i.test(f.home)||/^(QA\b|Synthetic\b)/i.test(f.away)||/synthetic/i.test(f.lname)))throw Error('QA fixtures refused in real-data source');
 const predictions=[];
 for(let i=0;i<fixtures.length;i+=150){
  predictions.push(...await readPages('predictions',predictionCols,[['fxid','in.('+fixtures.slice(i,i+150).map(f=>f.fxid).join(',')+')'],['made_at','not.is.null'],['made_at','lte.'+now.toISOString()],['pick','not.is.null'],['pick_prob','not.is.null'],['build','gte.62']],'fxid.asc',fetcher));
 }
 const preds=new Map(predictions.map(p=>[p.fxid,p]));if(preds.size!==predictions.length)throw Error('Duplicate prediction identity');
 // These are bounded GET reads of existing approved records, never provider/AI requests.
 const histories=new Map(),analysis_warnings=[];
 const lids=[...new Set(fixtures.map(f=>f.lid))];if(lids.length>100)throw Error('Analysis competition inventory exceeds reviewed bound');
 for(const lid of lids){
  const group=fixtures.filter(f=>f.lid===lid),first=group.map(f=>f.date).sort()[0],last=group.map(f=>f.date).sort().at(-1);
  const from=new Date(Date.parse(first)-HISTORY_DAYS*86400000).toISOString().slice(0,10);
  const quoted=x=>'"'+x.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
  const teams=[...new Set(group.flatMap(f=>[f.home,f.away]))].map(quoted).join(',');
  try{histories.set(lid,await readPages('fixtures',HISTORY_COLUMNS,[['provider','eq.af'],['lid','eq.'+lid],['or','(home.in.('+teams+'),away.in.('+teams+'))'],['date','gte.'+from],['date','lt.'+last],['status','in.(FT,FINISHED,AET,PEN)']],'fxid.asc',fetcher));}catch(e){analysis_warnings.push({lid,state:'history-unavailable',reason:e.message});}
 }
 /* Per-competition facts for Build 355 parity (goal-market base rates and the league table). GET-only,
    explicit columns, AF-only, one competition at a time. The finished window (analysis-projection.mjs
    COMPETITION_MONTHS) is read in half-year slices so every slice stays inside readPages' 1000-row
    bound; a slice over the bound, or any failure, omits that competition's entry with a warning rather
    than publishing a partial count. Upper bound: 100 competitions x (10 slices + 1 upcoming read) x
    5 pages x 2 capture passes = 11,000 GETs; ordinary request/egress accounting applies, no provider call. */
 const competitions=[];
 const from=competitionFrom(w.day),ahead=new Date(Date.parse(w.day)+COMPETITION_AHEAD_DAYS*86400000).toISOString().slice(0,10);
 const slices=[];for(let a=from;a<=w.day;){const d=new Date(a+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+6);const b=d.toISOString().slice(0,10);slices.push([a,b>w.day?null:b]);a=b;}
 if(slices.length>11)throw Error('Competition slice inventory exceeds reviewed bound');
 for(const lid of lids){
  try{
   const rows=[];
   for(const[a,b]of slices)rows.push(...await readPages('fixtures',COMPETITION_COLUMNS,[['provider','eq.af'],['lid','eq.'+lid],['status','in.(FT,FINISHED,AET,PEN)'],['date','gte.'+a],b?['date','lt.'+b]:['date','lte.'+w.day]],'fxid.asc',fetcher));
   const upcoming=await readPages('fixtures','lid,season,status,date,home,away',[['provider','eq.af'],['lid','eq.'+lid],['status','eq.NS'],['date','gte.'+w.day],['date','lte.'+ahead]],'fxid.asc',fetcher);
   if(new Set(rows.map(r=>r.fxid)).size!==rows.length)throw Error('Duplicate competition history row');
   competitions.push(projectCompetition(lid,{rows,upcoming,captureDay:w.day}));
  }catch(e){analysis_warnings.push({lid,state:'competition-unavailable',reason:e.message});}
 }
 // Raw arbitrary-prompt AI cache is deliberately neither read nor published.

 const payload={cards:fixtures.map(f=>({...project(f,CARD_SCHEMA),prediction:preds.has(f.fxid)?project(preds.get(f.fxid),CARD_SCHEMA.properties.prediction):null})),
  board:board===null?null:project(board,PAYLOAD_SCHEMA.properties.board),
  records:{engine:byKey.engine?project(byKey.engine,PAYLOAD_SCHEMA.properties.records.properties.engine):null,clv:byKey.clv?project(byKey.clv,PAYLOAD_SCHEMA.properties.records.properties.clv):null},
  slips:slips.map(s=>project(s,PAYLOAD_SCHEMA.properties.slips.items))};
 if(competitions.length)payload.competitions=competitions.map(c=>project(c,PAYLOAD_SCHEMA.properties.competitions.items));
 for(const c of payload.cards){const analysis=projectFixtureAnalysis(c,{board,history:histories.get(c.lid),now});if(analysis)c.analysis=analysis;}
 validatePresentationPayload(payload);
 const stamps=fixtures.map(f=>f.updated_at).filter(x=>x&&Number.isFinite(Date.parse(x))).sort((a,b)=>Date.parse(a)-Date.parse(b));
 return{payload,analysis_warnings,captured_at:now.toISOString(),from:w.from,to:w.to,window_cards:windowCount,cards:fixtures.length,predictions:predictions.length,latest_source_update:stamps.at(-1)??null};
}
export async function stableCollect(now=new Date(),fetcher=fetch,options={}){
 const a=await collect(now,fetcher,options),b=await collect(now,fetcher,options);
 if(digest(a)!==digest(b))throw Error('Source changed between coverage passes; retain previous mirror');
 return b;
}
export function requestFor(snapshot){
 const payload_text=JSON.stringify(snapshot.payload);
 return{version:'matchmind-real-mirror/1',source_project:'toqfdrcjzwnlydqekude',window_from:snapshot.from,window_to:snapshot.to,captured_at:snapshot.captured_at||new Date().toISOString(),
  window_cards:snapshot.window_cards,cards:snapshot.cards,predictions:snapshot.predictions,latest_source_update:snapshot.latest_source_update,payload_sha256:digest(payload_text),payload_text};
}
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function verifyDestination(request,receipt,fetcher=fetch){
 const rpc=async(name,body)=>{
  const r=await fetcher(new URL('/rest/v1/rpc/'+name,TARGET),{method:'POST',redirect:'error',headers:{apikey:TARGET_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Staging readback HTTP '+r.status);return r.json();
 };
 const status=await rpc('mm_preview_status_v1',{});
 if(status?.edition_id!==receipt.edition_id||status.payload_sha256!==request.payload_sha256||status.cards!==request.cards||status.predictions!==request.predictions)throw Error('Staging edition readback mismatch');
 const screens=await Promise.all(['scores','predictions','history','records','slips'].map(screen=>rpc('mm_preview_display_v3',{screen})));
 if(screens.some(s=>s.edition_id!==receipt.edition_id))throw Error('Staging edition changed during readback');
 const original=JSON.parse(request.payload_text),seen=new Map();
 for(const s of screens)for(const c of s.cards){
  const source=original.cards.find(x=>x.fxid===c.fxid);
  if(!source||canonical(c)!==canonical(s.screen==='scores'?{...source,prediction:null}:source))throw Error('Staging fixture/forecast identity or original value mismatch');
  seen.set(c.fxid,c);
 }
 const legacy=await rpc('mm_preview_display_v1',{screen:'scores'});
 if(legacy.edition_id!==receipt.edition_id)throw Error('Legacy staging edition changed during readback');
 for(const c of legacy.cards){const source=original.cards.find(s=>s.fxid===c.fxid);if(!source)throw Error('Legacy fixture identity mismatch');const {analysis,...old}=source;if(canonical(c)!==canonical({...old,prediction:null}))throw Error('Legacy closed fixture shape changed');}
 const legacySlips=await rpc('mm_preview_display_v1',{screen:'slips'});if(legacySlips.edition_id!==receipt.edition_id||canonical(legacySlips.slips)!==canonical(legacyPresentationPayload(original).slips))throw Error('Legacy whole issued bundle projection mismatch');
 for(const s of screens)if(['scores','predictions','history'].includes(s.screen)?canonical(s.competitions??null)!==canonical(original.competitions??null):Object.hasOwn(s,'competitions'))throw Error('Staging competition projection mismatch');
 if(Object.hasOwn(legacy,'competitions'))throw Error('Legacy screen must not carry competitions');
 const v2=await rpc('mm_preview_display_v2',{screen:'scores'});{const {competitions,...rest}=screens[0];if(canonical(v2)!==canonical(rest))throw Error('v2 screen must equal v3 without competitions');}
 if(seen.size!==original.cards.length||canonical(screens[1].board)!==canonical(original.board)||canonical(screens[3].records)!==canonical(original.records)||canonical(screens[4].slips)!==canonical(original.slips))throw Error('Staging complete projection readback mismatch');
 return{verified_cards:seen.size,verified_predictions:original.cards.filter(c=>c.prediction).length};
}
export async function publish(request,token,fetcher=fetch){
 if(typeof token!=='string'||token.length<32)throw Error('Protected MM_STAGING_MIRROR_TOKEN binding required');
 const r=await fetcher(new URL('/rest/v1/rpc/mm_preview_publish_v1',TARGET),{method:'POST',redirect:'error',headers:{apikey:TARGET_KEY,'Content-Type':'application/json','x-mm-preview-token':token},body:JSON.stringify({document:request}),signal:AbortSignal.timeout(60000)});
 /* The publisher's refusals are fixed strings ('Closed public payload validation failed', 'Refresh snapshot stale', ...).
    Report which one, bounded and single-line, so a failed refresh says why. The request token is never echoed. */
 if(!r.ok){let why='';try{const b=await r.json();why=String(b?.message||'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,160);}catch{}throw Error('Staging-only publication HTTP '+r.status+(why?': '+why:''));}
 const result=await r.json();
 if(result.cards!==request.cards||result.predictions!==request.predictions||result.payload_sha256!==request.payload_sha256)throw Error('Destination coverage/hash mismatch');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const extract=process.argv[2]==='--extract';
  if(!extract&&!process.env.MM_STAGING_MIRROR_TOKEN)throw Error('Protected MM_STAGING_MIRROR_TOKEN binding required');
  const snapshot=await stableCollect();const request=requestFor(snapshot);
  if(extract){if(!process.argv[3])throw Error('Private output path required');writeFileSync(process.argv[3],JSON.stringify(request),{mode:0o600});console.log(JSON.stringify({...request,payload_text:undefined,analysis_warnings:snapshot.analysis_warnings}));}
  else {const receipt=await publish(request,process.env.MM_STAGING_MIRROR_TOKEN);const verified=await verifyDestination(request,receipt);console.log(JSON.stringify({...receipt,...verified,analysis_warnings:snapshot.analysis_warnings}));}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
