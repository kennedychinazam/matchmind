// Independent, dependency-free Build 355 grading reference for regression tests.
 // This is NOT imported by the live app, and changing it cannot change published picks.
 // Mirrored from index.html: canonStatus, settledScore, gradePick, pickVerdict.
const FIN = new Set(['FT','AET','PEN']);
const STATUS_ALIAS = {FINISHED:'FT',AWARDED:'AWD',CANCELLED:'CANC',POSTPONED:'PST'};
export function isFinished(status) {
  const normalized = String(status ?? '').trim().toUpperCase();
  return FIN.has(STATUS_ALIAS[normalized] ?? normalized);
}
export function utcKickoff(date, time = '') {
  const d = String(date ?? '').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const raw = String(time ?? '').trim();
  const full = raw.match(/(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  const t = full ? full[2].padStart(2,'0') + ':' + full[3]
    : (raw.match(/^(\d{1,2}):(\d{2})/)?.slice(1).map((x,i) => i===0 ? x.padStart(2,'0') : x).join(':') ?? '00:00');
  const iso = (full ? full[1] : d) + 'T' + t + ':00Z';
  const timeMs = Date.parse(iso);
  return Number.isFinite(timeMs) ? timeMs : null;
}
export function settledScore(f) {
  if (!f) return null;
  let h = f.gh, a = f.ga;
  if (isFinished(f.status) && Number.isInteger(f.ft_h) && Number.isInteger(f.ft_a)
    && Number.isInteger(h) && Number.isInteger(a)
    && f.ft_h>=0 && f.ft_a>=0 && f.ft_h<=h && f.ft_a<=a) {
    h = f.ft_h; a = f.ft_a;
  }
  return {h, a};
}
export function resultCode(h,a) {
  if (!Number.isInteger(h) || !Number.isInteger(a) || h<0 || a<0) return null;
  return h>a ? '1' : h===a ? 'X' : '2';
}
const outcomes = {
  '1':['1'],'X':['X'],'2':['2'],
  '1X':['1','X'],'X2':['X','2'],'12':['1','2']
};
const htft = new Set(['1/1','1/X','1/2','X/1','X/X','X/2','2/1','2/X','2/2']);
export function gradePick(code, score, ht) {
  const c = String(code ?? ''), gh=score?.h, ga=score?.a;
  const actual = resultCode(gh,ga);
  if (!c || !actual) return null;
  const goals=gh+ga;
  const goalRules = {
    O15:goals>1.5,U15:goals<1.5,
    O25:goals>2.5,U25:goals<2.5,
    O35:goals>3.5,U35:goals<3.5,
    BTS:gh>0&&ga>0,NBT:!(gh>0&&ga>0)
  };
  if (Object.hasOwn(goalRules,c)) return goalRules[c] ? 'hit':'miss';
  if (c==='1D'||c==='2D') return actual==='X'?'void':
    ((c==='1D'&&actual==='1')||(c==='2D'&&actual==='2'))?'hit':'miss';
  if (Object.hasOwn(outcomes,c)) return outcomes[c].includes(actual)?'hit':'miss';
  if (htft.has(c)) {
    const hth=ht?.h, hta=ht?.a;
    if (!Number.isInteger(hth)||!Number.isInteger(hta)||hth<0||hta<0
        ||hth>gh||hta>ga) return null;
    const [h1,f1] = c.split('/');
    return resultCode(hth,hta)===h1&&actual===f1?'hit':'miss';
  }
  return null;
}
export function publishedVerdict(p,f,nowMs=Date.now(),today=null) {
  const now = nowMs;
  const localDay=today??new Date(now).toLocaleDateString('en-CA',{timeZone:'Africa/Lagos',
    year:'numeric',month:'2-digit',day:'2-digit'}); // test may pass explicit day
  const fin=!!f&&isFinished(f.status)&&Number.isInteger(f.gh)&&Number.isInteger(f.ga);
  const dead=(!f || f.provider!=='af')&&!fin&&String(p?.kickoff??'')<localDay;
  const off=!!f&&/POSTPON|CANCEL|ABAND|SUSP|AWARD/i.test(String(f.status??''));
  const live=!!f&&!fin&&!off&&!dead&&/^(1H|2H|HT|ET|BT|P|LIVE|INT)$/i.test(String(f.status??''));
  const original=utcKickoff(p?.kickoff,p?.ktime);
  const moved=utcKickoff(f?.date,f?.time);
  const playedLate=fin&&original!=null&&moved!=null&&(moved-original)>=48*3600000;
  const late=!dead&&!live&&(playedLate||(!fin&&original!=null&&(now-original)>=48*3600000));
  const done=fin&&!late;
  const grade=done?gradePick(p?.pick,settledScore(f)):null;
  const excluded=!(Number.isInteger(p?.build)&&p.build>=62);
  return {excluded,done,grade,orphan:dead,off:off&&!late,live,voidLate:late,
    isVoid:grade==='void'||late,pending:!done&&!dead&&!live&&!late};
}
export function score1x2(probs,actual) {
  const p=[Number(probs?.p_home),Number(probs?.p_draw),Number(probs?.p_away)];
  const classes=['1','X','2'];
  if (!classes.includes(actual)||p.some(x=>!Number.isFinite(x)||x<0||x>1)
      ||Math.abs(p.reduce((a,b)=>a+b,0)-1)>0.005) return null;
  const idx=classes.indexOf(actual);
  const brier=p.reduce((s,x,i)=>s+(x-(i===idx?1:0))**2,0);
  let choice=0;
  if (p[1]>p[0]&&p[1]>=p[2])choice=1;
  else if (p[2]>p[0]&&p[2]>p[1])choice=2;
  return {brier,logLoss:-Math.log(Math.max(1e-12,p[idx])),
    correct:choice===idx,confidence:p[choice],choice:classes[choice]};
}
