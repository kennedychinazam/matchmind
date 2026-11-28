// Actual slip presentation and a separate exhaustive outcome oracle; invented inputs only.
import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\n}',a);assert.ok(a>=0&&b>a,'actual '+name);return source.slice(a,b+2);}
const leg=(i,{prob=.75,pDraw=.2,code='1D',market='Draw No Bet',price=i===1?1.8:1.6}={})=>({key:i,f:{fxid:i,date:'2026-11-27',time:'20:00',home:'Invented Home '+i,away:'Invented Away '+i},L:{id:39,name:'Invented League'},prob,pDraw,code,market,_real:price,sel:'Invented selection'});
const dnb=l=>l.code==='1D'||l.code==='2D';
function oracle(legs){
 const sum={fullWin:0,reducedReturn:0,refund:0,loss:0,expectedReturnOdds:0};
 function visit(i,p,factor,outcomes){if(i===legs.length){const key=outcomes.includes('L')?'loss':outcomes.every(x=>x==='W')?'fullWin':outcomes.every(x=>x==='V')?'refund':'reducedReturn';sum[key]+=p;sum.expectedReturnOdds+=p*factor;return;}const l=legs[i],v=dnb(l)?l.pDraw:0,w=dnb(l)?l.prob*(1-v):l.prob;for(const [state,q,odds]of[['W',w,l._real],['V',v,1],['L',1-w-v,0]])if(q>0)visit(i+1,p*q,factor*odds,[...outcomes,state]);}
 visit(0,1,1,[]);return sum;
}
function summary(legs){const c=vm.createContext({SLIP_MAX_LEGS:20,legs});vm.runInContext(fn('slipOutcomeSummary')+'\nresult=slipOutcomeSummary(legs);',c);return c.result;}
function render(legs,{targetOdds=null}={}){
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',addEventListener(){},querySelectorAll:()=>[]});return nodes.get(id);};const original=JSON.stringify(legs),prices=new Map(legs.map(l=>[l.f.fxid,l._real]));let saved=0,recordWrites=0;
 const c=vm.createContext({$,SLIP_MAX_LEGS:20,slipState:{today:false,leagues:null,markets:new Set(['1X2','DNB','DC']),riskPct:30,n:legs.length,targetOdds},slipCandidatesFromBoard:()=>legs,dailyRealPrice:id=>prices.get(id),escapeHtml:String,leagueTitle:L=>L.name,localHM:(_d,t)=>t,chipCode:x=>x,genSlipWithSpinner(){},saveState:()=>saved++,recordPick:()=>recordWrites++,SLIP_BOARD_UNREAD:'unread',SLIP_BOARD_EMPTY:'empty',SLIP_NO_PRICE:'No price shown',SLIP_NO_PRICE_WHY:'No price available',SLIP_NO_PRICE_TARGET:'No target price'});
 if(source.includes('function slipOutcomeSummary('))vm.runInContext(fn('slipOutcomeSummary'),c);vm.runInContext(fn('slipPool')+'\n'+fn('genSlip')+'\ngenSlip();',c);
 return{html:$('slipOut').innerHTML,unchanged:JSON.stringify(legs)===original,saved,recordWrites};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-11,`${actual} != ${expected}`);
test('actual two-DNB slip separates full win, reduced return, stake back and loss',()=>{
 const legs=[leg(1),leg(2,{code:'2D'})],r=render(legs);for(const [label,p]of[['Full win','36.0%'],['Reduced return','24.0%'],['Stake back','4.0%'],['Lose','36.0%']])assert.match(r.html,new RegExp(label+'[\\s\\S]{0,170}'+p.replace('.','\\.')));assert.doesNotMatch(r.html,/56\.3%|44% chance this loses|Every leg must win/);assert.equal(r.unchanged,true);assert.equal(r.recordWrites,0);
});
test('actual mixed slip reports unconditional outcomes and makes its independence assumption visible',()=>{
 const r=render([leg(1),leg(2,{prob:.8,code:'1',market:'Winner',pDraw:null})]);for(const p of['48.0%','16.0%','0.0%','36.0%'])assert.ok(r.html.includes(p));assert.match(r.html,/Model estimates; assumes independent matches\./);assert.match(r.html,/Max \$10 return/);assert.doesNotMatch(r.html,/60\.0%|40% chance this loses/);
});
test('DNB probabilities and existing complete-data expected gross return match exhaustive outcomes',()=>{
 const legs=[leg(1),leg(2,{code:'2D'})],r=summary(legs),expected=oracle(legs);
 for(const k of['fullWin','reducedReturn','refund','loss','expectedReturnOdds'])near(r[k],expected[k]);near(r.fullWinOdds,2.88);near(r.expectedReturnOdds,1.4848);near(r.minSurvivingOdds,1);
 assert.match(render(legs).html,/Estimated gross return across all outcomes, including losses: \$14\.85/);
});
test('deterministic mixed fixtures agree with an independent exhaustive small-slip oracle',()=>{
 let seed=371;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let t=0;t<60;t++){
  const legs=Array.from({length:1+t%5},(_,i)=>{const isDnb=random()<.7;return leg(i+1,{prob:.05+random()*.9,pDraw:isDnb?random()*.8:null,code:isDnb?(i%2?'2D':'1D'):'1',market:isDnb?'Draw No Bet':'Winner',price:1.1+random()*3});});
  const original=JSON.stringify(legs),actual=summary(legs),expected=oracle(legs);assert.equal(actual.available,true);
  for(const k of['fullWin','reducedReturn','refund','loss','expectedReturnOdds'])near(actual[k],expected[k]);near(actual.fullWin+actual.reducedReturn+actual.refund+actual.loss,1);assert.equal(JSON.stringify(legs),original);
 }
});
test('ordinary binary slips retain product probability, complement and expected-return arithmetic',()=>{
 const legs=[leg(1,{prob:.8,code:'1',market:'Winner',pDraw:null}),leg(2,{prob:.7,code:'1X',market:'Double Chance',pDraw:NaN})],r=summary(legs);assert.equal(r.available,true);assert.equal(r.hasDnb,false);near(r.fullWin,.56);near(r.loss,.44);near(r.reducedReturn,0);near(r.refund,0);near(r.expectedReturnOdds,.56*1.8*1.6);
});
test('twenty-leg calculation stays bounded and accounts for every category',()=>{
 const r=summary(Array.from({length:20},(_,i)=>leg(i+1,{code:i%2?'2D':'1D'})));assert.equal(r.available,true);near(r.fullWin,.6**20);near(r.refund,.2**20);near(r.survival,.8**20);near(r.fullWin+r.reducedReturn+r.refund+r.loss,1);
});
test('single DNB has no reduced-return event and its draw is a stake refund',()=>{const r=summary([leg(1)]);near(r.fullWin,.6);near(r.refund,.2);near(r.loss,.2);near(r.reducedReturn,0);});
test('zero and certain conditional outcomes remain coherent while no non-draw population is unavailable',()=>{
 for(const prob of[0,1]){const r=summary([leg(1,{prob})]);assert.equal(r.available,true);near(r.fullWin,prob*.8);near(r.refund,.2);near(r.loss,(1-prob)*.8);}
 assert.equal(summary([leg(1,{pDraw:1})]).available,false);
});
test('missing, nonnumeric and out-of-domain DNB inputs cannot invent aggregate probabilities or EV',()=>{
 for(const field of['prob','pDraw'])for(const value of[null,undefined,NaN,Infinity,-Infinity,-.01,1.01,'0.75',true]){
  const r=summary([{...leg(1),[field]:value}]);assert.equal(r.available,false,field+' '+String(value));for(const k of['fullWin','reducedReturn','refund','loss','survival','expectedReturnOdds'])assert.equal(r[k],null);
 }
});
test('invalid selection identity, canonical market/code and input bounds fail closed',()=>{
 const bad=[null,[],Array.from({length:21},(_,i)=>leg(i+1)),[leg(1),leg(1,{code:'2D'})],[leg(1,{code:'1D',market:'Winner'})],[leg(1,{code:'1',market:'Draw No Bet'})],[leg(1,{code:'unknown'})],[{...leg(1),market:Object.create(null)}],[{...leg(1),f:{fxid:0}}],[{...leg(1),f:{fxid:'1'}}],[{...leg(1),f:{fxid:1.5}}]];
 for(const legs of bad){const r=summary(legs);assert.equal(r.available,false);assert.equal(r.fullWinOdds,null);}
});
test('partial, string and nonfinite bookmaker prices preserve probabilities but suppress money',()=>{
 for(const price of[null,undefined,NaN,Infinity,-Infinity,1,0,-2,'1.8']){
  const r=summary([leg(1),{...leg(2),_real:price}]);assert.equal(r.available,true);near(r.fullWin,.36);assert.equal(r.pricedLegs,1);for(const k of['fullWinOdds','minSurvivingOdds','expectedReturnOdds'])assert.equal(r[k],null);
 }
});
test('overflowing price products cannot quote infinite money',()=>{const r=summary([leg(1,{price:1e200}),leg(2,{price:1e200})]);assert.equal(r.available,true);assert.equal(r.fullWinOdds,null);assert.equal(r.expectedReturnOdds,null);});
test('actual missing-draw rendering is unavailable, with no invented range or expected money',()=>{
 const r=render([leg(1,{pDraw:null}),leg(2)]);assert.match(r.html,/Probability unavailable/);assert.doesNotMatch(r.html,/56\.3%|44% chance|Estimated gross return|a \$10 stake returns/);assert.equal(r.recordWrites,0);
});
test('actual malformed price rendering cannot print NaN, Infinity or an aggregate return',()=>{
 for(const price of[Infinity,NaN,'1.8',null]){const r=render([leg(1),leg(2,{price})]);assert.doesNotMatch(r.html,/\$\d+\.\d\d|Infinity|NaN/);assert.match(r.html,/No price shown/);assert.equal(r.unchanged,true);}
});
test('same issued selections give exactly the same arithmetic regardless of array order',()=>{const legs=[leg(1),leg(2,{prob:.8,code:'1',market:'Winner',pDraw:null}),leg(3,{code:'2D',pDraw:.3})];const a=summary(legs),b=summary([...legs].reverse());for(const k of['fullWin','reducedReturn','refund','loss','expectedReturnOdds'])near(a[k],b[k]);});
