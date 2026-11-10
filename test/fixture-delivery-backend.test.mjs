import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPresentationPayload,validatePresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const fixture=()=>({fxid:1,lid:1,lname:'Synthetic League',lcountry:'Test',date:'2026-11-03',time:'12:00',status:'FT',elapsed:null,home:'Synthetic A',away:'Synthetic B',gh:1,ga:0,ft_h:1,ft_a:0,ht_h:null,ht_a:null,updated_at:'2026-11-03T12:00:00.000Z',provider:null});
const pred=()=>({fxid:1,lid:1,lname:'Original Synthetic League',home:'Synthetic A',away:'Synthetic B',pick:'1',pick_prob:.6,market:'Home',p_home:.6,p_draw:.2,p_away:.2,xg_home:1.5,xg_away:.7,kickoff:'2026-11-03',ktime:'12:00',made_at:'2026-11-02T12:00:00.000Z',withheld_at:null,final_pick:'1',build:355});
const board=()=>({v:1,ahead:7,builtAt:'2026-11-03T00:00:00.000Z',n:1,notPassed:0,noBars:0,rows:[{f:1,l:1,n:'Synthetic League',d:'2026-11-03',t:'12:00',h:'Synthetic A',a:'Synthetic B',p:'1',q:.6,m:'Home',g:null,z:true,pw:.6,pd:.2,pq:.2,xh:1.5,xa:.7}]});
test('all selected immutable predictions preserved exactly; inputs untouched',()=>{const f=fixture(),p=pred();const before=JSON.stringify([f,p]);const out=buildPresentationPayload({fixtures:[f],predictions:[p]});const expected={...p};delete expected.fxid;assert.deepEqual(out.cards[0].prediction,expected);assert.equal(JSON.stringify([f,p]),before);});
test('orphan required prediction cannot silently disappear',()=>assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],predictions:[{...pred(),fxid:2}]}),/inventory|unaccounted|missing/i));
test('invalid actual calendar date rejected',()=>assert.throws(()=>buildPresentationPayload({fixtures:[{...fixture(),date:'2026-99-99'}]}),/date|text/i));
test('inconsistent board probabilities rejected',()=>{const b=board();b.rows[0].pw=.8;b.rows[0].pd=.8;b.rows[0].pq=.8;assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],board:b}),/probability/i);});
test('partial vector rejected while all unknown remains unknown',()=>{const p=pred();p.p_draw=null;assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],predictions:[p]}),/probability/i);const unknown={...pred(),p_home:null,p_draw:null,p_away:null};assert.equal(buildPresentationPayload({fixtures:[fixture()],predictions:[unknown]}).cards[0].prediction.p_home,null);});
test('null fulltime and AET status survive unchanged',()=>{const f={...fixture(),status:'AET',gh:3,ga:2,ft_h:null,ft_a:null};const out=buildPresentationPayload({fixtures:[f]});assert.equal(out.cards[0].ft_h,null);assert.equal(out.cards[0].status,'AET');});
test('duplicate source inventory rejected',()=>{assert.throws(()=>buildPresentationPayload({fixtures:[fixture(),fixture()]}),/duplicate/i);assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],predictions:[pred(),pred()]}),/duplicate/i);});
test('raw blobs, nestedextras, credentials cannot enter projected response',()=>{const f={...fixture(),raw:{odds:'private-marker'},api_key:'private-marker'};const out=buildPresentationPayload({fixtures:[f]});assert(!JSON.stringify(out).includes('private-marker'));out.cards[0].raw={source:'mustreject'};assert.throws(()=>validatePresentationPayload(out),/unsupported/i);});
test('incomplete score/source fields are not defaulted or silently dropped',()=>{const f=fixture();delete f.ft_h;assert.throws(()=>buildPresentationPayload({fixtures:[f]}),/missing source/i);});
test('board identity must agree with selected fixture facts',()=>{const b=board();b.rows[0].h='Other';assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],board:b}),/identity/i);});
test('untrusted prototype map keys rejected',()=>{const out=buildPresentationPayload({fixtures:[fixture()]});out.records.engine={key:'engine',build:355,computed_at:null,payload:{v:1,days:JSON.parse('{"2026-11-03":{"__proto__":[1,1,1]}}'),total:0,graded:0,withheld:0,excluded:0,pending:0,orphan:0,off:0,ungradeable:0,voidLate:0}};assert.throws(()=>validatePresentationPayload(out),/map key/i);});

test('original forecast identity is retained separately from current display metadata',()=>{const p=pred();const out=buildPresentationPayload({fixtures:[fixture()],predictions:[p]});assert.equal(out.cards[0].prediction.lname,'Original Synthetic League');assert.equal(out.cards[0].lname,'Synthetic League');assert.equal(out.cards[0].prediction.home,p.home);});

test('issued slip fixture inventory cannot silently disappear',()=>{const slip={day:'2026-11-03',tier:'test',odds:1.8,build:355,step:'issued',legs:[{fxid:999,d:'2026-11-01',h:'Home',a:'Away',code:'1X',p:.8}]};assert.throws(()=>buildPresentationPayload({fixtures:[fixture()],slips:[slip]}),/slip fixture inventory/i);});

test('PostgreSQL RFC3339 offset timestamps preserve exact original text',()=>{const f={...fixture(),updated_at:'2026-11-03T12:00:00.123456+00:00'},p={...pred(),made_at:'2026-11-02T13:00:00+01:00'};const b=board();b.builtAt='2026-11-03T05:30:00+05:30';const out=buildPresentationPayload({fixtures:[f],predictions:[p],board:b});assert.equal(out.cards[0].updated_at,f.updated_at);assert.equal(out.cards[0].prediction.made_at,p.made_at);assert.equal(out.board.builtAt,b.builtAt);});
test('timestamp syntax calendar ranges and explicit timezone are fail closed',()=>{for(const updated_at of ['2026-02-30T12:00:00Z','2026-11-03T24:00:00Z','2026-11-03T12:60:00Z','2026-11-03T12:00:60Z','2026-11-03T12:00:00','2026-11-03T12:00:00+16:00','0000-01-01T00:00:00Z'])assert.throws(()=>buildPresentationPayload({fixtures:[{...fixture(),updated_at}]}),/timestamp/i,updated_at);});

test('publisher preserves all admitted competitions and refuses a missing immutable fixture instead of emitting a subset',()=>{
 const fixtures=[fixture(),{...fixture(),fxid:2,lid:2,lname:'UEFA Champions League',home:'Champions Home',away:'Champions Away'}];
 const predictions=[pred(),{...pred(),fxid:2,lid:2,lname:'UEFA Champions League',home:'Champions Home',away:'Champions Away'}];
 const out=buildPresentationPayload({fixtures,predictions});
 assert.equal(out.cards.length,2);assert.deepEqual(out.cards.map(c=>c.lname),['Synthetic League','UEFA Champions League']);
 assert.deepEqual(out.cards.map(c=>c.prediction.pick_prob),[.6,.6]);
 assert.throws(()=>buildPresentationPayload({fixtures:fixtures.slice(0,1),predictions}),/Unaccounted required prediction inventory 2/);
});
