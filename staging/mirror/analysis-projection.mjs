// Pure presentation of existing source facts. No model, network, credentials or writes.
import {createHash} from 'node:crypto';
import {isPresentationTimestamp} from '../../backend/fixture-delivery/contract.mjs';
export const HISTORY_DAYS=365;
export const HISTORY_COLUMNS='fxid,lid,date,time,status,home,away,gh,ga,ft_h,ft_a,updated_at,provider';
const validVector=v=>v.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)&&Math.abs(v.reduce((a,b)=>a+b,0)-1)<=.0002;
const validXg=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const kickoff=c=>Date.parse(c.date+'T'+(c.time||'00:00').slice(0,5)+':00Z');
const timed=(s,now)=>isPresentationTimestamp(s)&&Date.parse(s)<=+now;
export function projectFixtureAnalysis(card,{board=null,history=[],writeup=null,writeupApproval=null,now=new Date()}={}){
 const sourceAt=card.updated_at;
 const a={source:'api-football/fixture-history-365d',source_at:sourceAt};
 const b=board?.rows?.find(b=>b.f===card.fxid&&b.l===card.lid&&b.h===card.home&&b.a===card.away&&b.d===card.date&&b.t===card.time);
 // The board may publish informational probabilities even when its betting gate has withheld a pick.
 // Never replace any immutable issued result vector or manufacture a new market from xG.
 if(b&&timed(board.builtAt,now)&&Date.parse(board.builtAt)<=kickoff(card)){
  a.source='published-board';a.source_at=board.builtAt;
  if(validVector([b.pw,b.pd,b.pq]))a.result={p_home:b.pw,p_draw:b.pd,p_away:b.pq};
  if(validXg(b.xh)&&validXg(b.xa)){a.xg_home=b.xh;a.xg_away=b.xa;}
 }
 const before=history.filter(h=>h.fxid!==card.fxid&&h.provider==='af'&&h.lid===card.lid&&h.date<card.date&&h.date>=new Date(Date.parse(card.date)-HISTORY_DAYS*86400000).toISOString().slice(0,10)&&['FT','FINISHED','AET','PEN'].includes(h.status)&&timed(h.updated_at,now)).map(h=>({...h,gh:['FT','FINISHED'].includes(h.status)?h.gh:h.ft_h,ga:['FT','FINISHED'].includes(h.status)?h.ga:h.ft_a})).filter(h=>Number.isInteger(h.gh)&&h.gh>=0&&Number.isInteger(h.ga)&&h.ga>=0).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.fxid-a.fxid);
 const form=team=>before.filter(h=>h.home===team||h.away===team).slice(0,5).reverse().map(h=>h.gh===h.ga?'D':((h.home===team?h.gh>h.ga:h.ga>h.gh)?'W':'L'));
 const home=form(card.home),away=form(card.away);
 const stamps=before.map(h=>h.updated_at).sort((a,b)=>Date.parse(a)-Date.parse(b));
 if(stamps.length){a.history_source_at=stamps.at(-1);if(a.source!=='published-board')a.source_at=a.history_source_at;}
 if(home.length||away.length)a.form={home,away};
 const h2h=before.filter(h=>(h.home===card.home&&h.away===card.away)||(h.home===card.away&&h.away===card.home)).slice(0,5).map(({date,home,away,gh,ga})=>({date,home,away,gh,ga}));
 if(h2h.length)a.h2h=h2h;
 // An independently reviewed exact-content hash and full identity are mandatory.
 // Cache table has no approval flag or identity text columns. Its existing authorized server
 // endpoint owns publication; accept only the same fixture ID and an original pre-kickoff timestamp.
 // Render this timestamp as cached source commentary, never as the immutable prediction's rationale.
 if(writeupApproval?.fxid===card.fxid&&writeupApproval.lid===card.lid&&writeupApproval.home===card.home&&writeupApproval.away===card.away&&writeupApproval.date===card.date&&writeupApproval.time===card.time&&writeupApproval.source_at===writeup?.updated_at&&writeupApproval.sha256===createHash('sha256').update(writeup?.text||'').digest('hex')&&writeup?.fxid===card.fxid&&typeof writeup.text==='string'&&writeup.text.trim()&&writeup.text.length<=32768&&timed(writeup.updated_at,now)&&Date.parse(writeup.updated_at)<=kickoff(card)&&typeof writeup.model==='string'&&writeup.model.length<=60){
  // Paragraphs are retained using printable separators because the closed wire text rejects controls.
  const text=writeup.text.replace(/\r?\n\s*\r?\n/g,' ¶ ').replace(/[\r\n\t]/g,' ');
  if(text.length<=32768&&!/[\u0000-\u001f\u007f]/.test(text))a.writeup={text,source:'server-cache/'+writeup.model,source_at:writeup.updated_at};
 }
 return Object.keys(a).length>2?a:null;
}

/* ── PER-COMPETITION FACTS FOR BUILD 355 PARITY (goal markets and the League Table) ──────────────
   Build 355 prices Over 1.5/2.5/3.5 and BTTS with footballEngine.marketsFor(lambdaH, lambdaA, rates),
   where rates() (index.html, `rates(upTo){`) counts BTTS/over lines over the competition's loaded
   finished matches, and it draws the League Table with tableAsOf/tableAt/seasonRoster/latestSeasonOf
   over the same matches. The browser read is `date >= cacheCutoff()` with CACHE_MONTHS = 60
   (build 306), read in two disjoint halves (recent first, the settled half in background before the
   board is issued). The comment at 355's league read that still says "24 months" predates build 306.
   So the window here is 60 calendar months before the capture day (COMPETITION_MONTHS), up to and
   including the capture day; only the counts rates() needs and the standing rows leave the runner.
   Score semantics are 355's settledRow: a finished status (FT, FINISHED alias, AET, PEN) with both
   goals present; the 90-minute ft_h/ft_a pair is used when it is a whole non-negative pair no greater
   than the final score, otherwise the final score. */
export const COMPETITION_MONTHS=60;
export const COMPETITION_AHEAD_DAYS=60; // 355 LEAGUE_AHEAD_DAYS: upcoming fixtures a season/roster can come from
export const COMPETITION_COLUMNS='fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,updated_at';
export const STANDINGS_MAX_ROWS=64;
const STATUS_ALIAS={FINISHED:'FT',AWARDED:'AWD',CANCELLED:'CANC',POSTPONED:'PST'};
const canon=s=>{const v=String(s==null?'':s).trim().toUpperCase();return STATUS_ALIAS[v]||v;};
const isFin=s=>['FT','AET','PEN'].includes(canon(s));
export function competitionFrom(captureDay){const d=new Date(captureDay+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-COMPETITION_MONTHS);return d.toISOString().slice(0,10);}
/* 355 settledScore/settledRow, literally. */
export function settled90(r){
 const gh=r.gh,ga=r.ga,fh=r.ft_h,fa=r.ft_a;
 if(gh!=null&&ga!=null&&Number.isInteger(fh)&&Number.isInteger(fa)&&fh>=0&&fa>=0&&fh<=gh&&fa<=ga)return{gh:fh,ga:fa};
 return{gh,ga};
}
/* The matches 355 holds in L.matches: finished with both goals, sorted by date (stable over fxid order). */
export function competitionMatches(rows){
 return rows.filter(r=>isFin(r.status)&&r.gh!=null&&r.ga!=null).map(r=>({date:r.date,home:r.home,away:r.away,...settled90(r),season:r.season??null,round:r.round??null}))
  .map((m,i)=>[m,i]).sort((a,b)=>a[0].date<b[0].date?-1:a[0].date>b[0].date?1:a[1]-b[1]).map(x=>x[0]);
}
/* rates() counts: the engine turns these into {btts,1.5,2.5,3.5,n} only when n >= 30. */
export function rateCounts(matches){
 let btts=0,o15=0,o25=0,o35=0;
 for(const m of matches){const t=m.gh+m.ga;if(m.gh>0&&m.ga>0)btts++;if(t>1.5)o15++;if(t>2.5)o25++;if(t>3.5)o35++;}
 return{n:matches.length,btts,o15,o25,o35};
}
/* Faithful port of 355's roundKind/isLeaguePhase/seasonSeqFor/roundRobinOK/tableAt/seasonRoster/
   tableAsOf/latestSeasonOf with upTo = null (renderStandings). test/competition-projection.test.mjs runs
   the browser's own functions on the same input and requires identical rows. */
const LEAGUE_PHASE={'Regular Season':1,'League Stage':1};
const roundKind=r=>{if(r==null)return null;const s=String(r),i=s.indexOf(' - ');return i>=0?s.slice(0,i):s;};
const leaguePhase=m=>LEAGUE_PHASE[roundKind(m.round)]===1;
export function standingsOf(matches,upcoming){
 let season=null;const take=s=>{if(s!=null&&(season==null||s>season))season=s;};
 for(const m of matches)take(m.season);for(const f of upcoming)take(f.season);
 if(season==null)return null;
 const prev=matches.filter(m=>m.season===season-1);let rr=null;
 if(prev.length){const n={};for(const m of prev){if(!leaguePhase(m))continue;if(m.home)n[m.home]=(n[m.home]||0)+1;if(m.away)n[m.away]=(n[m.away]||0)+1;}
  const names=Object.keys(n);if(names.length>2){const want=2*(names.length-1),tally={};for(const t of names)tally[n[t]]=(tally[n[t]]||0)+1;let mode=null,best=-1;for(const k in tally)if(tally[k]>best){best=tally[k];mode=+k;}rr=mode===want;}else rr=false;}
 const R={};const bump=(t,gf,ga)=>{if(!t)return;const r=R[t]||(R[t]={pts:0,gf:0,ga:0,played:0,won:0,drawn:0,lost:0});r.played++;r.gf+=gf;r.ga+=ga;r.pts+=gf>ga?3:gf===ga?1:0;if(gf>ga)r.won++;else if(gf===ga)r.drawn++;else r.lost++;};
 for(const m of matches){if(m.season!==season||m.gh==null||m.ga==null||!leaguePhase(m))continue;bump(m.home,m.gh,m.ga);bump(m.away,m.ga,m.gh);}
 const names=Object.keys(R).sort((a,b)=>(R[b].pts-R[a].pts)||((R[b].gf-R[b].ga)-(R[a].gf-R[a].ga))||(R[b].gf-R[a].gf)||(a<b?-1:a>b?1:0));
 const roster=new Set();for(const m of matches)if(m.season===season&&leaguePhase(m)){if(m.home)roster.add(m.home);if(m.away)roster.add(m.away);}
 if(rr===true)for(const f of upcoming)if(f.season===season){if(f.home)roster.add(f.home);if(f.away)roster.add(f.away);}
 if(!names.length&&!roster.size)return null;
 const seen=new Set(names),rest=[...roster].filter(n=>!seen.has(n)).sort((a,b)=>a<b?-1:a>b?1:0);
 const zero={played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0};
 const rows=[...names.map(n=>[n,R[n]]),...rest.map(n=>[n,zero])].map(([team,r],i)=>({rank:i+1,team,played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.gf,ga:r.ga,points:r.pts}));
 return rows.length?{season,rows}:null;
}
/* One entry per competition. Rates and standings are independent: either may be absent. A table over
   the reviewed row bound is omitted, never truncated. */
export function projectCompetition(lid,{rows=[],upcoming=[],captureDay}){
 const from=competitionFrom(captureDay),inWindow=rows.filter(r=>r.lid===lid&&r.date>=from&&r.date<=captureDay);
 const sourceAt=inWindow.map(r=>r.updated_at).filter(x=>isPresentationTimestamp(x)).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null;
 const matches=competitionMatches(inWindow);
 const ahead=new Date(Date.parse(captureDay)+COMPETITION_AHEAD_DAYS*86400000).toISOString().slice(0,10);
 const ups=upcoming.filter(f=>f.lid===lid&&canon(f.status)==='NS'&&f.date>=captureDay&&f.date<=ahead).map(f=>({home:f.home,away:f.away,season:f.season??null}));
 const out={lid,source:'api-football/competition-'+COMPETITION_MONTHS+'m',from,to:captureDay};
 if(sourceAt)out.source_at=sourceAt;
 out.rates=rateCounts(matches);
 const table=standingsOf(matches,ups);
 if(table&&table.rows.length<=STANDINGS_MAX_ROWS&&table.rows.every(r=>typeof r.team==='string'&&r.team.length<=160))out.standings=table;
 return out;
}
