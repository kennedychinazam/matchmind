import test from 'node:test';
import assert from 'node:assert/strict';
import {isFinished,utcKickoff,settledScore,resultCode,gradePick,publishedVerdict,score1x2}
  from '../lib/independent-grade.mjs';

test('finished provider aliases and live states are distinct',()=>{
  for(const s of ['FINISHED','FT','AET','PEN']) assert.equal(isFinished(s),true,s);
  for(const s of ['NS','LIVE','POSTPONED','CANCELLED']) assert.equal(isFinished(s),false,s);
});
test('90-minute score takes precedence over AET when a valid pair exists',()=>{
  const fixture={status:'FINISHED',gh:2,ga:1,ft_h:1,ft_a:1};
  assert.deepEqual(settledScore(fixture),{h:1,a:1});
  assert.equal(resultCode(1,1),'X');
  assert.equal(gradePick('X',settledScore(fixture)),'hit');
  assert.equal(gradePick('1',settledScore(fixture)),'miss');
});
test('invalid or missing 90-minute score falls back to provider final goals',()=>{
  assert.deepEqual(settledScore({status:'FT',gh:2,ga:1,ft_h:3,ft_a:0}),{h:2,a:1});
  assert.deepEqual(settledScore({status:'FT',gh:2,ga:1,ft_h:1,ft_a:null}),{h:2,a:1});
});
test('every headline outcome and double-chance selection grades correctly',()=>{
  const s={h:2,a:1};
  for(const c of ['1','1X','12']) assert.equal(gradePick(c,s),'hit',c);
  for(const c of ['2','X','X2']) assert.equal(gradePick(c,s),'miss',c);
});
test('draw-no-bet draws void rather than lose or win',()=>{
  assert.equal(gradePick('1D',{h:1,a:1}),'void');
  assert.equal(gradePick('2D',{h:1,a:1}),'void');
  assert.equal(gradePick('2D',{h:0,a:1}),'hit');
  assert.equal(gradePick('1D',{h:0,a:1}),'miss');
});
test('goals and BTTS grades are independent of match winner',()=>{
  const s={h:1,a:4};
  for(const c of ['O15','O25','O35','BTS'])assert.equal(gradePick(c,s),'hit',c);
  for(const c of ['U15','U25','U35','NBT'])assert.equal(gradePick(c,s),'miss',c);
  assert.equal(gradePick('U35',{h:1,a:2}),'hit');
  assert.equal(gradePick('NBT',{h:0,a:0}),'hit');
  assert.equal(gradePick('MADE_UP',{h:1,a:0}),null);
});
test('HT/FT needs a valid half-time score',()=>{
  assert.equal(gradePick('X/1',{h:2,a:1},{h:0,a:0}),'hit');
  assert.equal(gradePick('1/1',{h:2,a:1},{h:0,a:0}),'miss');
  assert.equal(gradePick('X/1',{h:2,a:1}),null);
  assert.equal(gradePick('X/1',{h:2,a:1},{h:3,a:0}),null);
});
const p={build:355,kickoff:'2026-10-20',ktime:'18:00',pick:'1X'};
const now=Date.parse('2026-10-23T19:00:00Z');
test('48-hour void is final for a match played late',()=>{
  const f={date:'2026-10-22',time:'18:00',status:'FINISHED',provider:'af',
    gh:2,ga:1,ft_h:2,ft_a:1};
  const v=publishedVerdict(p,f,now,'2026-10-23');
  assert.equal(v.done,false);
  assert.equal(v.voidLate,true);
  assert.equal(v.grade,null);
});
test('match moved 47 hours is not considered a late-played void',()=>{
  const f={date:'2026-10-22',time:'17:00',status:'FINISHED',provider:'af',
    gh:2,ga:1,ft_h:2,ft_a:1};
  const v=publishedVerdict(p,f,now,'2026-10-23');
  assert.equal(v.done,true);
  assert.equal(v.grade,'hit');
});
test('unplayed fixture voids only once 48h passes, not while in play',()=>{
  const f={date:'2026-10-20',time:'18:00',status:'NS',provider:'af'};
  const v1=publishedVerdict(p,f,Date.parse('2026-10-22T17:59:00Z'),'2026-10-22');
  const v2=publishedVerdict(p,f,Date.parse('2026-10-22T18:00:00Z'),'2026-10-22');
  assert.equal(v1.pending,true);
  assert.equal(v2.voidLate,true);
  const live=publishedVerdict(p,{...f,status:'LIVE'},now,'2026-10-23');
  assert.equal(live.live,true);
  assert.equal(live.voidLate,false);
});
test('historical reconstructed build is excluded even if score is available',()=>{
  const v=publishedVerdict({...p,build:-1},
    {date:'2026-10-20',time:'18:00',status:'FINISHED',provider:'af',gh:1,ga:0},now,'2026-10-23');
  assert.equal(v.excluded,true);
});
test('UTC kickoff parser handles plain and embedded timestamps',()=>{
  assert.equal(utcKickoff('2026-10-20','18:00'),Date.parse('2026-10-20T18:00:00Z'));
  assert.equal(utcKickoff('2026-10-20','2026-10-20T18:00:00Z'),Date.parse('2026-10-20T18:00:00Z'));
});
test('Brier and log loss match known 1X2 values',()=>{
  const x=score1x2({p_home:0.6,p_draw:0.25,p_away:0.15},'1');
  assert.ok(Math.abs(x.brier-(0.4**2+0.25**2+0.15**2))<1e-12);
  assert.ok(Math.abs(x.logLoss+Math.log(0.6))<1e-12);
  assert.equal(x.correct,true);
  assert.equal(score1x2({p_home:0.8,p_draw:0.8,p_away:0.2},'1'),null);
  const uniform=score1x2({p_home:1/3,p_draw:1/3,p_away:1/3},'X');
  assert.ok(Math.abs(uniform.brier-2/3)<1e-12);
});
