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
 const before=history.filter(h=>h.fxid!==card.fxid&&h.provider==='af'&&h.lid===card.lid&&h.date<card.date&&h.date>=new Date(Date.parse(card.date)-HISTORY_DAYS*86400000).toISOString().slice(0,10)&&['FT','AET','PEN'].includes(h.status)&&timed(h.updated_at,now)).map(h=>({...h,gh:h.status==='FT'?h.gh:h.ft_h,ga:h.status==='FT'?h.ga:h.ft_a})).filter(h=>Number.isInteger(h.gh)&&h.gh>=0&&Number.isInteger(h.ga)&&h.ga>=0).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.fxid-a.fxid);
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
