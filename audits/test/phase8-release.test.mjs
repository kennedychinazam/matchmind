import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {localDatabase} from '../test-support/local-db.mjs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const manifest=()=>JSON.parse(read('audits/phase8/release-manifest.json'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}).trim();
const blob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const source=read('index.html').toString().replaceAll('\r\n','\n');
function declaration(name){
 const match=source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
 assert.ok(match,`missing existing function ${name}`);return match[0];
}
function rules(now){
 const snippets=[source.match(/const PUBLISH_AHEAD_DAYS = \d+;/)?.[0],source.match(/const VOID_AFTER_HOURS = \d+;/)?.[0],
  source.match(/const STATUS_ALIAS = \{[^\n]+;/)?.[0],source.match(/const FINISHED=\[[^\n]+;/)?.[0],
  declaration('kickoffUTC'),declaration('canonStatus'),source.match(/function isFin\(st\)\{[^\n]+\}/)?.[0],
  ...['tooFarAheadToPublish','pickOriginalKick','fixtureCurrentKick','pickPlayedLate','pickPlayState'].map(declaration)];
 assert.ok(snippets.every(Boolean),'existing rule source unavailable');
 const context=vm.createContext({now});
 vm.runInContext(`Date.now=()=>now;\n${snippets.join('\n')}`,context,{timeout:1000});
 return expression=>vm.runInContext(expression,context,{timeout:1000});
}

test('combined release pins additive Phase5 files without replacing inherited Phase7 components',()=>{
 const m=manifest();
 assert.equal(m.refs.phase7,'19c9a30e84f9172aefd876ec680cdf858f475938');
 assert.equal(m.refs.phase5,'f56caab20a5dfabc237646909058d57dac7f9a65');
 assert.equal(m.phase5_additions.length,10);
 for(const entry of [...m.phase5_additions,...m.phase5_reused]){
  assert.equal(git('rev-parse',`${m.refs.phase5}:${entry.path}`),entry.source_blob,entry.path);
  assert.equal(blob(read(entry.path)),entry.release_blob,entry.path);
  if(entry.release_blob!==entry.source_blob)assert.ok(entry.modification,`unexplained modification: ${entry.path}`);
 }
});

test('release preserves every byte of the approved Build355 public application',()=>{
 const m=manifest(),approved=execFileSync('git',['show',`${m.refs.public_baseline}:index.html`],{cwd:root,maxBuffer:4*1024*1024});
 assert.equal(blob(approved),'a60db2a997c95980fc311f0ebab6e0f4ccba4cf6');
 assert.ok(read('index.html').equals(approved),'Build355 engine, Smart Bet, public publishing and UI must remain exact');
 assert.equal(blob(read('index.html')),m.protected_application.git_blob);
});

test('actual application publication permits exactly 72 hours and refuses the next minute',()=>{
 const run=rules(Date.parse('2026-10-24T12:00:00Z'));
 assert.equal(run("tooFarAheadToPublish({date:'2026-10-27',time:'11:59'})"),false);
 assert.equal(run("tooFarAheadToPublish({date:'2026-10-27',time:'12:00'})"),false);
 assert.equal(run("tooFarAheadToPublish({date:'2026-10-27',time:'12:01'})"),true);
});

test('actual application void is final at 48 hours for both unplayed and late-played fixtures',()=>{
 const run=rules(0),p="{kickoff:'2026-10-24',ktime:'12:00'}";
 assert.equal(run(`pickPlayState(${p},null,Date.parse('2026-10-26T11:59:59.999Z'))`),'pending');
 assert.equal(run(`pickPlayState(${p},null,Date.parse('2026-10-26T12:00:00Z'))`),'void');
 assert.equal(run(`pickPlayState(${p},{date:'2026-10-26',time:'11:59',status:'FT',gh:1,ga:0},0)`),'played');
 assert.equal(run(`pickPlayState(${p},{date:'2026-10-26',time:'12:00',status:'FT',gh:1,ga:0},0)`),'void');
});

test('read-only Phase5 extraction excludes negative final scores and preserves valid regulation-time labels',async()=>{
 const db=localDatabase('phase8-release');
 try{
  await db.start();
  db.sql(`CREATE TABLE public.fixtures(fxid bigint PRIMARY KEY,lid integer,home text,away text,date date,time text,status text,gh integer,ga integer,ft_h integer,ft_a integer,updated_at timestamptz,season integer,xg_h real,xg_a real);
   CREATE TABLE public.predictions(fxid bigint PRIMARY KEY,lid integer,lname text,home text,away text,build integer,made_at timestamptz,kickoff date,ktime text,xg_home real,xg_away real,odds_snap_id bigint,odds_at_pick_at timestamptz,p_home real,p_draw real,p_away real);
   CREATE TABLE public.odds_snapshots(id bigint,fxid bigint,captured_at timestamptz,mins_to_kick integer,h numeric,d numeric,a numeric,books integer);
   INSERT INTO public.fixtures SELECT id,39,'Alpha','Beta','2026-09-02','18:00','FT',h,a,fh,fa,'2026-09-03T00:00:00Z',2026,1.5,1 FROM(VALUES(1,1,0,NULL::int,NULL::int),(2,-1,0,NULL,NULL),(3,0,-1,NULL,NULL),(4,2,1,1,1))x(id,h,a,fh,fa);
   INSERT INTO public.predictions SELECT fxid,lid,'League',home,away,355,'2026-09-01T12:00:00Z',date,time,1.5,1,NULL,NULL,.6,.2,.2 FROM public.fixtures;`);
  const out=db.sql(read('audits/phase5/011_readonly_cohort.sql').toString());
  const result=JSON.parse(out.split('\n').find(line=>line.startsWith('{')));
  assert.equal(result.metadata.transaction_read_only,'on');
  assert.deepEqual(result.rows.map(r=>[r.id,r.actual]),[['1','1'],['4','X']]);
  assert.equal(db.sql('select count(*) from public.fixtures'),'4','read-only extraction must not mutate source rows');
 }finally{db.close();}
});
