import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyDestination,requestFor} from '../staging/mirror/refresh.mjs';
import {projectFixtureAnalysis} from '../staging/mirror/analysis-projection.mjs';
import {buildPresentationPayload,validatePresentationPayload,PAYLOAD_SCHEMA} from '../backend/fixture-delivery/contract.mjs';
const now=new Date('2026-11-13T10:00:00Z'),stamp='2026-11-13T09:00:00Z';
const fixture=()=>({fxid:1,lid:2,lname:'Test league',lcountry:'Test',date:'2026-11-14',time:'12:00',status:'NS',elapsed:null,home:'Home',away:'Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af'});
const board=()=>({builtAt:stamp,rows:[{f:1,l:2,h:'Home',a:'Away',d:'2026-11-14',t:'12:00',pw:.5,pd:.3,pq:.2,xh:1.5,xa:.9,p:null,q:null}]});
const h=(extra={})=>({fxid:20,lid:2,date:'2026-11-10',time:'20:00',status:'FT',home:'Home',away:'Away',gh:2,ga:1,ft_h:2,ft_a:1,updated_at:'2026-11-10T22:00:00Z',provider:'af',...extra});
const project=(options={})=>projectFixtureAnalysis(fixture(),{now,...options});
test('no qualifying pick retains approved board result and xG without inventing markets',()=>{const a=project({board:board()});assert.deepEqual(a.result,{p_home:.5,p_draw:.3,p_away:.2});assert.equal(a.xg_home,1.5);assert.ok(!a.goals&&!a.combos&&!a.htft&&!a.correct_scores);});
test('board full identity and pre-kickoff source timestamp must agree',()=>{for(const patch of [{h:'Other'},{l:3},{d:'2026-11-15'},{t:'13:00'}]){const b=board();Object.assign(b.rows[0],patch);assert.equal(project({board:b}),null);}const b=board();b.builtAt='2026-11-15T10:00:00Z';assert.equal(project({board:b}),null);});
test('partial/invalid vectors and absent xG are not filled with zero',()=>{const b=board();b.rows[0].pd=null;b.rows[0].xh=null;assert.equal(project({board:b}),null);});
test('form and H2H preserve actual prior 90-minute results and source time',()=>{const a=project({history:[h(),h({fxid:21,date:'2026-11-11',status:'AET',gh:3,ga:2,ft_h:1,ft_a:1})]});assert.deepEqual(a.form,{home:['W','D'],away:['L','D']});assert.equal(a.h2h[0].gh,1);assert.equal(a.history_source_at,'2026-11-10T22:00:00Z');});
test('future/same-day/other league/non-AF/incomplete extra-time facts excluded',()=>{for(const patch of [{date:'2026-11-15'},{date:'2026-11-14'},{lid:4},{provider:'sample'},{status:'AET',ft_h:null},{updated_at:'2026-11-20T00:00:00Z'}])assert.equal(project({history:[h(patch)]}),null);});
test('raw AI cache omitted without independent exact-content identity approval',()=>{const writeup={fxid:1,text:'Cached analysis',model:'approved-model',updated_at:stamp};assert.equal(project({writeup}),null);const writeupApproval={...fixture(),source_at:stamp,sha256:createHash('sha256').update(writeup.text).digest('hex')};assert.equal(project({writeup,writeupApproval}).writeup.text,writeup.text);assert.equal(project({writeup:{...writeup,text:'Altered'},writeupApproval}),null);});
test('closed projection remains compatible with old cards and rejects private extras',()=>{const old=buildPresentationPayload({fixtures:[fixture()]});validatePresentationPayload(old);const a=project({board:board()});const p=buildPresentationPayload({fixtures:[{...fixture(),analysis:a}]});assert.deepEqual(p.cards[0].analysis,a);p.cards[0].analysis.raw={key:'secret'};assert.throws(()=>validatePresentationPayload(p),/unsupported/);});
test('nested analysis probability vectors validated independently of prediction',()=>{const p=buildPresentationPayload({fixtures:[fixture()]});p.cards[0].analysis={source:'published-board',source_at:stamp,result:{p_home:.8,p_draw:.3,p_away:.2}};assert.throws(()=>validatePresentationPayload(p),/probability/);});
test('browser and staging schema equal closed source schema; source proposal remains unchanged',()=>{const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.deepEqual(JSON.parse(html.match(/const FIXTURE_DISPLAY_SCHEMA=(.*);\r?\n/)[1]),PAYLOAD_SCHEMA);const up=readFileSync(new URL('../staging/mirror/STAGING-analysis-up.sql',import.meta.url),'utf8');assert.deepEqual(JSON.parse(up.split('$schema$')[1]),PAYLOAD_SCHEMA);assert.match(up,/Isolated real-data preview required/);});

test('collector FINISHED alias retains genuine source history',()=>{const a=project({history:[h({status:'FINISHED'})]});assert.deepEqual(a.form,{home:['W'],away:['L']});assert.equal(a.h2h[0].gh,2);});

test('mirror readback verifies expanded v2 plus permanent closed v1 independently',async()=>{
 const p=buildPresentationPayload({fixtures:[{...fixture(),analysis:project({board:board()})}]}),request=requestFor({payload:p,from:'2026-11-07',to:'2026-11-20',window_cards:1,cards:1,predictions:0,latest_source_update:stamp}),receipt={edition_id:'test'},paths=[];
 const fetcher=async(u,o)=>{paths.push(u.pathname);if(u.pathname.endsWith('status_v1'))return{ok:true,json:async()=>({...receipt,payload_sha256:request.payload_sha256,cards:1,predictions:0})};const screen=JSON.parse(o.body).screen,cards=['scores','predictions','history'].includes(screen)?structuredClone(p.cards):[];if(screen==='scores')cards.forEach(c=>c.prediction=null);if(u.pathname.endsWith('display_v1'))cards.forEach(c=>delete c.analysis);return{ok:true,json:async()=>({...receipt,screen,cards,board:null,records:{engine:null,clv:null},slips:[]})};};
 assert.deepEqual(await verifyDestination(request,receipt,fetcher),{verified_cards:1,verified_predictions:0});assert.ok(paths.some(p=>p.endsWith('display_v2'))&&paths.some(p=>p.endsWith('display_v1')));
});

test('expanded admission retains permanent512KiB original-schema bound for old clients',()=>{const base=buildPresentationPayload({fixtures:[fixture()]});base.cards=Array.from({length:700},(_,i)=>({...fixture(),fxid:i+1,home:'H'.repeat(160),away:'A'.repeat(160),lname:'L'.repeat(160),lcountry:'C'.repeat(100),prediction:null}));const bytes=Buffer.byteLength(JSON.stringify(base));assert.ok(bytes>524288&&bytes<1048576);assert.throws(()=>validatePresentationPayload(base),/Legacy display payload/);});
