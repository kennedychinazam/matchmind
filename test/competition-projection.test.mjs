// Build 355 parity for the per-competition projection (goal-market base-rate counts and the League Table).
// The reference is the browser's OWN functions, extracted from index.html and run unchanged in a VM. They are
// pinned by SHA-256 and were verified byte-identical to Build 355 (`git show origin/main:index.html`) on 2026-11-20.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {competitionMatches,rateCounts,standingsOf,projectCompetition,settled90,competitionFrom,COMPETITION_MONTHS,COMPETITION_AHEAD_DAYS} from '../staging/mirror/analysis-projection.mjs';
import {validatePresentationPayload,buildPresentationPayload,legacyPresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function extract(head){const a=src.indexOf(head);assert.ok(a>=0&&src.indexOf(head,a+1)<0,'unique '+head);let i=src.indexOf('{',a),d=0;for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&!--d)break;}return src.slice(a,i+1);}
const PINNED={'function roundKind(':'d83120d2d83ce1aafd2fb3a9c00694de6c0cae1a9dab28768b82119a31be82de','function isLeaguePhase(':'8f50031db0f98dbbf522b3017dc3683dcdd6604884b7b1aa593545e8a483352e',
 'function seasonSeqFor(':'f99c9169537f091c2d8e59eebb44cfcab780add05bfbe70b6e078a33d282490a','function roundRobinOK(':'d0c0a693d414596c16eb0482dcf332c674b1a397b738532e98bd33a9ee985332',
 'function tableAt(':'230d3d4e807347ddceeb2a6fc747bc48fc69e1d67e4fa38939800e06dc64c17f','function seasonRoster(':'f71c34b32d36a7d71b138dce99fc382cb7a84a192e48b1e295daef3a4606c95a',
 'function tableAsOf(':'bd5762b62d94f979163be6d18067f54d46bcd5199b7048b1bb3c356edeecbb96','function latestSeasonOf(':'c4cefd0770daca019051fb7a61ba4ffdcd23ded24b029b60e24f336b6771197c',
 '  rates(upTo){':'deaba1ea0c80ef1871d8390ec786df6a36fa0d260bc9beb64769735f4d555e7d'};
const code={};for(const [h,sha] of Object.entries(PINNED)){code[h]=extract(h);assert.equal(createHash('sha256').update(code[h]).digest('hex'),sha,'Build 355 function unchanged: '+h);}
const ctx=vm.createContext({});
vm.runInContext(`const LEAGUE_PHASE = { 'Regular Season': 1, 'League Stage': 1 };const _seasonSeq = new WeakMap();const _rrOK = new WeakMap();const _engCache = new WeakMap();
${Object.entries(code).filter(([h])=>h.startsWith('function')).map(([,c])=>c).join('\n')}
var engine = { matches: [], hgOf(m){ return m.hg; }, agOf(m){ return m.ag; }, ${code['  rates(upTo){'].trim()} };
var api = { tableAsOf, latestSeasonOf, engine };`,ctx);
const B=vm.runInContext('api',ctx);
// Build 355's settledScore (index.html at origin/main), verbatim, as the score rule reference.
function settledScore355(r){
  const gh = r ? r.gh : null, ga = r ? r.ga : null, fh = r ? r.ft_h : null, fa = r ? r.ft_a : null;
  if(gh != null && ga != null && Number.isInteger(fh) && Number.isInteger(fa)
     && fh >= 0 && fa >= 0 && fh <= gh && fa <= ga)
    return { gh: fh, ga: fa, via: 'ft', fgh: gh, fga: ga };
  return { gh, ga, via: 'final', fgh: gh, fga: ga };
}
// Deterministic synthetic competition: a prior double round-robin season, a current season with a play-off,
// a qualifying round, extra-time rows with and without a valid 90-minute pair, an unplayed side seeded from
// upcoming fixtures, and non-finished rows that must be ignored.
function synthetic({roundRobin=true,teams=6}={}){
 const T=Array.from({length:teams},(_,i)=>'Team '+String.fromCharCode(65+i));let id=1,rows=[];const day0=Date.parse('2025-08-01');
 const add=(season,date,home,away,gh,ga,{round='Regular Season - 1',status='FINISHED',ft_h=null,ft_a=null}={})=>rows.push({fxid:id++,lid:7,season,round,date,status,home,away,gh,ga,ft_h,ft_a,updated_at:'2026-11-19T10:00:00Z'});
 let d=0;const day=()=>new Date(day0+(d++)*86400000).toISOString().slice(0,10);
 for(const h of T)for(const a of T)if(h!==a)add(2025,day(),h,a,(h.charCodeAt(5)*3+a.charCodeAt(5))%4,(a.charCodeAt(5)*5+h.charCodeAt(5))%3);
 if(!roundRobin)rows=rows.filter((r,i)=>i%3);
 add(2025,day(),T[0],T[1],1,1,{round:'Relegation Play-off'});
 const cur=T.slice(0,teams-1);
 for(const h of cur)for(const a of cur)if(h<a)add(2026,day(),h,a,(h.charCodeAt(5)+2*a.charCodeAt(5))%4,(a.charCodeAt(5)+h.charCodeAt(5))%3,{round:'Regular Season - 2'});
 add(2026,day(),T[0],'Qualifier FC',3,0,{round:'Qualifying Round'});
 add(2026,day(),T[1],T[2],3,2,{status:'AET',ft_h:2,ft_a:2});          // valid 90-minute pair
 add(2026,day(),T[2],T[3],2,1,{status:'PEN',ft_h:3,ft_a:0});          // impossible pair: final score
 add(2026,day(),T[3],T[4],1,0,{status:' ft '});                        // canonStatus trims/upper-cases
 add(2026,day(),T[0],T[4],null,null,{status:'FINISHED'});              // no score: not a match
 add(2026,day(),T[1],T[3],0,0,{status:'NS'});                          // not finished
 const upcoming=[{lid:7,season:2026,status:'NS',date:'2026-11-22',home:T[teams-1],away:T[0]},{lid:7,season:2026,status:'NS',date:'2026-11-23',home:'Qualifier FC',away:T[1]}];
 return{rows,upcoming};
}
function reference(rows,upcoming){
 // 355's loader: L.matches gets every finished row with both goals, scored by settledRow, sorted by date.
 const isFin=s=>['FT','AET','PEN'].includes(({FINISHED:'FT'})[String(s??'').trim().toUpperCase()]||String(s??'').trim().toUpperCase());
 const matches=rows.filter(r=>isFin(r.status)&&r.gh!=null&&r.ga!=null).map(r=>{const s=settledScore355(r);return{date:r.date,home:r.home,away:r.away,hg:s.gh,ag:s.ga,_x:{season:r.season,round:r.round}};}).sort((a,b)=>a.date<b.date?-1:1);
 const L={matches,upcoming:upcoming.filter(f=>f.status==='NS').map(f=>({home:f.home,away:f.away,season:f.season}))};
 const season=B.latestSeasonOf(L),tbl=B.tableAsOf(L,null,season);
 B.engine.matches=matches;delete B.engine._rates;
 return JSON.parse(JSON.stringify({season,rows:tbl?tbl.rows:null,rates:B.engine.rates()}));
}
for(const [name,opt] of [['double round-robin, roster seeded from upcoming',{}],['non round-robin prior season, no seeding',{roundRobin:false}],['thin competition under 30 results',{teams:4}]])
 test('port equals Build 355 functions: '+name,()=>{
  const {rows,upcoming}=synthetic(opt),ref=reference(rows,upcoming);
  const port=standingsOf(competitionMatches(rows),upcoming.map(f=>({home:f.home,away:f.away,season:f.season})));
  assert.equal(port.season,ref.season);
  assert.deepEqual(port.rows.map(r=>[r.rank,r.team,r.played,r.points,r.gf-r.ga]),ref.rows.map(r=>[r.pos,r.team,r.pl,r.pts,r.gd]));
  for(const r of port.rows){assert.equal(r.won+r.drawn+r.lost,r.played);assert.equal(3*r.won+r.drawn,r.points);}
  const c=rateCounts(competitionMatches(rows));
  if(ref.rates===null)assert.ok(c.n<30);else assert.deepEqual({btts:c.btts/c.n,1.5:c.o15/c.n,2.5:c.o25/c.n,3.5:c.o35/c.n,n:c.n},ref.rates);
 });
test('score rule is 355 settledScore on every finished shape',()=>{
 for(const r of synthetic().rows.filter(r=>r.gh!=null))assert.deepEqual(settled90(r),(({gh,ga})=>({gh,ga}))(settledScore355(r)));
});
test('projectCompetition: window, upcoming bound, provenance and closed payload; legacy readers never see it',()=>{
 const {rows,upcoming}=synthetic(),day='2026-11-20';
 assert.equal(competitionFrom(day),'2021-11-20');assert.equal(COMPETITION_MONTHS,60);assert.equal(COMPETITION_AHEAD_DAYS,60);
 const old={...rows[0],fxid:9999,date:'2021-11-19'},late={...upcoming[0],date:'2027-01-20',home:'Far Future'};
 const c=projectCompetition(7,{rows:[...rows,old],upcoming:[...upcoming,late],captureDay:day});
 assert.equal(c.rates.n,competitionMatches(rows).length,'row before the 60-month window excluded');
 assert.ok(!c.standings.rows.some(r=>r.team==='Far Future'),'upcoming beyond 60 days excluded');
 assert.equal(c.source_at,'2026-11-19T10:00:00Z');assert.deepEqual([c.from,c.to],['2021-11-20',day]);
 const card={fxid:1,lid:7,lname:'Synthetic League',lcountry:'Test',date:day,time:'12:00',status:'NS',elapsed:null,home:'Team A',away:'Team F',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:'2026-11-20T00:00:00Z',provider:'af'};
 const payload={...buildPresentationPayload({fixtures:[card]}),competitions:[c]};validatePresentationPayload(payload);
 assert.ok(!Object.hasOwn(legacyPresentationPayload(payload),'competitions'));
 for(const bad of [x=>x.competitions.push(structuredClone(c)),x=>{x.competitions[0].lid=8;},x=>{x.competitions[0].rates.btts=x.competitions[0].rates.n+1;},x=>{x.competitions[0].extra=1;}]){const v=structuredClone(payload);bad(v);assert.throws(()=>validatePresentationPayload(v));}
 const many=Array.from({length:65},(_,i)=>({fxid:i+1,lid:7,season:2026,round:'Regular Season - 1',date:'2026-10-01',status:'FT',home:'H'+i,away:'A'+i,gh:1,ga:0,ft_h:null,ft_a:null}));
 assert.ok(!projectCompetition(7,{rows:many,captureDay:day}).standings,'a table over 64 rows is omitted, never truncated');
});
test('collector reads the 60-month window in bounded GET slices and projects one entry per competition',async()=>{
 const {collect}=await import('../staging/mirror/refresh.mjs');
 const now=new Date('2026-11-20T09:00:00Z'),{rows,upcoming}=synthetic(),calls=[];
 const card={fxid:500,lid:7,lname:'Example League',lcountry:'Test',date:'2026-11-21',time:'15:00',status:'NS',elapsed:null,home:'Team A',away:'Team F',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:'2026-11-20T08:00:00Z',provider:'af'};
 const val=(u,k)=>u.searchParams.getAll(k);
 const fetcher=async(u,o)=>{calls.push({method:o.method,select:u.searchParams.get('select'),dates:val(u,'date'),status:u.searchParams.get('status'),lid:u.searchParams.get('lid')});
  const table=u.pathname.split('/').pop();let out=[];
  if(table==='fixtures'&&!u.searchParams.get('lid'))out=[card];
  else if(table==='fixtures'&&u.searchParams.get('select').includes('round')){const ds=val(u,'date');out=rows.filter(r=>ds.every(d=>{const [op,v]=d.split('.');return op==='gte'?r.date>=v:op==='lt'?r.date<v:r.date<=v;})&&['FT','FINISHED','AET','PEN'].includes(r.status.trim().toUpperCase()));}
  else if(table==='fixtures'&&u.searchParams.get('status')==='eq.NS')out=upcoming;
  const page=out.slice(+u.searchParams.get('offset'),+u.searchParams.get('offset')+200);
  return{ok:true,headers:{get:()=>'0-0/'+out.length},json:async()=>page};};
 const snap=await collect(now,fetcher);
 assert.ok(calls.every(c=>c.method==='GET'));
 const slices=calls.filter(c=>c.select==='fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,updated_at');
 assert.equal(slices.length,11,'ten half-year slices plus the capture day');assert.equal(slices[0].dates[0],'gte.2021-11-20');assert.equal(slices.at(-1).dates.at(-1),'lte.2026-11-20');
 assert.ok(slices.every(c=>c.status==='in.(FT,FINISHED,AET,PEN)'&&c.lid==='eq.7'));
 const finishedInSource=rows.filter(r=>['FT','FINISHED','AET','PEN'].includes(r.status.trim().toUpperCase()));
 const expected=projectCompetition(7,{rows:finishedInSource,upcoming,captureDay:'2026-11-20'});
 assert.deepEqual(snap.payload.competitions,[expected]);assert.deepEqual(snap.analysis_warnings.filter(w=>w.state==='competition-unavailable'),[]);
 const bytes=Buffer.byteLength(JSON.stringify(snap.payload.competitions));assert.ok(bytes<2000,'one small entry per competition: '+bytes);
});
/* 2026-11-20 21:36 UTC: reading the 60-month competition facts in BOTH capture passes stretched a capture to
   minutes, the two passes straddled the production collector's write, and every refresh was refused. The core is
   still read twice and must match; the competition facts are read once, between the passes. */
test('stable capture reads competition facts once and still refuses a changing core',async()=>{
 const {stableCollect,collect}=await import('../staging/mirror/refresh.mjs');
 const now=new Date('2026-11-20T09:00:00Z'),{rows,upcoming}=synthetic();
 const card={fxid:500,lid:7,lname:'Example League',lcountry:'Test',date:'2026-11-21',time:'15:00',status:'NS',elapsed:null,home:'Team A',away:'Team F',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:'2026-11-20T08:00:00Z',provider:'af'};
 const val=(u,k)=>u.searchParams.getAll(k);
 const make=(cardFor)=>{let windowReads=0;const calls=[];const fetcher=async(u,o)=>{calls.push(u.searchParams.get('select'));
  const table=u.pathname.split('/').pop();let out=[];
  if(table==='fixtures'&&!u.searchParams.get('lid')&&!u.searchParams.get('fxid'))out=[cardFor(windowReads++)];
  else if(table==='fixtures'&&u.searchParams.get('select').includes('round')){const ds=val(u,'date');out=rows.filter(r=>ds.every(d=>{const [op,v]=d.split('.');return op==='gte'?r.date>=v:op==='lt'?r.date<v:r.date<=v;})&&['FT','FINISHED','AET','PEN'].includes(r.status.trim().toUpperCase()));}
  else if(table==='fixtures'&&u.searchParams.get('status')==='eq.NS')out=upcoming;
  const page=out.slice(+u.searchParams.get('offset'),+u.searchParams.get('offset')+200);
  return{ok:true,headers:{get:()=>'0-0/'+out.length},json:async()=>page};};return{fetcher,calls};};
 const steady=make(()=>card),snap=await stableCollect(now,steady.fetcher);
 const slice='fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,updated_at';
 assert.equal(steady.calls.filter(c=>c===slice).length,11,'competition slices read once per capture, not once per pass');
 const single=await collect(now,make(()=>card).fetcher);
 assert.deepEqual(snap.payload,single.payload,'same edition as a single full collect');
 const live=make(i=>i===0?card:{...card,status:'1H',elapsed:3,gh:0,ga:0,updated_at:'2026-11-20T08:05:00Z'});
 await assert.rejects(stableCollect(now,live.fetcher),/Source changed between coverage passes/);
});
