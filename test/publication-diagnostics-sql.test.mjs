// Exact captured validators; invented payloads; own pinned network-none PostgreSQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCandidate,profiles} from '../backend/publication-diagnostics/build-candidate.mjs';
const captures=fileURLToPath(new URL('../../mm08-evidence/',import.meta.url));
const name='mm-publication-diagnostics-'+process.pid,image='postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36';
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=(db,s)=>docker(['exec','-i',name,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],s);
function example(s,key=''){
 if(s.nullable)return null;
 if(s.type==='object')return Object.fromEntries((s.required||[]).map(k=>[k,example(s.properties[k],k)]));
 if(s.type==='map')return{};
 if(s.type==='array')return Array.from({length:s.min||0},()=>example(s.items));
 if(s.type==='boolean')return false;
 if(s.type==='number')return Math.max(0,s.min||0);
 if(s.type==='string')return s.format==='date'?'2026-11-27':s.format==='timestamp'?'2026-11-27T00:00:00Z':key==='status'?'NS':'x';
 throw Error('Unhandled fixture schema');
}
const clone=x=>structuredClone(x),json=x=>literal(JSON.stringify(x))+'::jsonb';
function materializerFixture(db,card,board){
 sql(db,`create function mm_fixture_delivery.publisher_allowed()returns boolean language sql as $$select true$$;
 create function mm_fixture_delivery.league_label(text,text,bigint)returns text language sql as $$select coalesce($1,$2,'x')$$;
 create function mm_fixture_delivery.lean_projection(jsonb)returns jsonb language sql as $$select '{}'::jsonb$$;
 create function mm_fixture_delivery.odds_projection(jsonb)returns jsonb language sql as $$select '{}'::jsonb$$;
 create table public.fixtures(fxid bigint,lid bigint,lname text,lcountry text,date text,time text,status text,elapsed int,home text,away text,gh int,ga int,ft_h int,ft_a int,ht_h int,ht_a int,updated_at timestamptz,provider text,home_logo text,away_logo text,llogo text);
 create table public.predictions(fxid bigint,lid bigint,lname text,home text,away text,pick text,pick_prob numeric,market text,p_home numeric,p_draw numeric,p_away numeric,xg_home numeric,xg_away numeric,kickoff text,ktime text,made_at timestamptz,withheld_at timestamptz,final_pick text,build int);
 create table public.shared_records(key text,payload jsonb,build int,computed_at timestamptz);
 create table public.daily_slips(day text,tier text,odds numeric,build int,step text,legs jsonb);
 create table mm_fixture_delivery.editions(edition_id uuid,edition_day date,as_of timestamptz,expires_at timestamptz,provenance text,cards int,predictions int,payload jsonb);
 insert into public.fixtures select * from jsonb_populate_record(null::public.fixtures,${json(card)}||jsonb_build_object('date',(statement_timestamp() at time zone 'UTC')::date));
 insert into public.shared_records values('board',${json(board)},1,null);`);
}
test('exact source builder rejects drift, profile guessing and capture overwrite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mm-diagnostic-builder-'));try{
  for(const n of Object.keys(profiles.production))await writeFile(join(dir,'production-'+n+'.sql'),await readFile(join(captures,'production-'+n+'.sql')));
  await assert.rejects(buildCandidate('unknown',dir,join(dir,'out.sql')),/Choose exact/);
  await assert.rejects(buildCandidate('production',dir,join(dir,'production-schema_valid.sql')),/overwrite/);
  await writeFile(join(dir,'production-payload_valid.sql'),'tampered');await assert.rejects(buildCandidate('production',dir,join(dir,'out.sql')),/hash mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('publication diagnostic sidecars preserve exact validators and reveal bounded private reasons',{timeout:180000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mm-publication-candidate-'));let started=false;
 try{
  docker(['run','-d','--name',name,'--network','none','-e','POSTGRES_PASSWORD=invented-local-only',image]);started=true;
  let ready=false;for(let i=0;i<40;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,150));}}assert.ok(ready);
  sql('postgres','create role anon;create role authenticated;create role service_role;create role mm_display_materializer;');
  for(const profile of Object.keys(profiles)){
   const db='fixture_'+profile;sql('postgres','create database '+db+';');sql(db,'create schema mm_fixture_delivery;grant usage on schema mm_fixture_delivery to service_role,mm_display_materializer;');
   const baseline={};for(const n of Object.keys(profiles[profile])){baseline[n]=await readFile(join(captures,profile+'-'+n+'.sql'),'utf8');sql(db,baseline[n]+';');}
   const schema=JSON.parse(baseline.payload_valid.match(/\$schema\$(.*?)\$schema\$/s)[1]);
   const base={cards:[],board:null,records:{engine:null,clv:null},slips:[]};
   const card=example(schema.properties.cards.items);card.home='private-home-sentinel';card.away='private-away-sentinel';const rich={...clone(base),cards:[card]};
   const before=sql(db,"select mm_fixture_delivery.payload_valid("+json(rich)+");");assert.equal(before,'t');
   const board=example({...schema.properties.board,nullable:false});materializerFixture(db,card,board);
   // Exact original materializer gives only the generic rejection, with no field evidence.
   sql(db,"update public.fixtures set home=repeat('x',161);");
   assert.throws(()=>sql(db,'select mm_fixture_delivery.materialize();'),/Incomplete or unsupported presentation inventory/);
   const candidate=join(dir,profile+'.sql');await buildCandidate(profile,captures,candidate);sql(db,await readFile(candidate,'utf8'));
   const inspect=v=>JSON.parse(sql(db,'select mm_publication_diagnostics.inspect('+json(v)+');'));
   const check=(v,code,path)=>{const d=inspect(v);assert.equal(d.accepted,sql(db,'select coalesce(mm_fixture_delivery.payload_valid('+json(v)+'),false);')==='t');if(code)assert.equal(d.code,code);if(path)assert.equal(d.path,path);assert.equal(d.profile,profile);assert.equal(d.validator_sha256,profiles[profile].payload_valid);assert.match(d.payload_sha256,/^[a-f0-9]{64}$/);assert.ok(JSON.stringify(d).length<800);assert.doesNotMatch(JSON.stringify(d),/private-|sensitive|unexpected_payload_key/);return d;};
   await t.test(profile+': unchanged authoritative boolean functions and valid payload identity',()=>{
    for(const n of ['schema_valid','payload_valid']){const got=sql(db,"select pg_get_functiondef('mm_fixture_delivery."+n+'('+(n==='schema_valid'?'jsonb,jsonb,integer':'jsonb')+")'::regprocedure);")+'\n';assert.equal(createHash('sha256').update(got).digest('hex'),profiles[profile][n]);}
    assert.equal(check(base,'VALID').accepted,true);assert.equal(check(rich,'VALID').accepted,true);
   });
   await t.test(profile+': nested type, required, unknown, map and timestamp failures expose schema-only paths',()=>{
    let v=clone(rich);v.cards[0].home=200;check(v,'SCHEMA_TYPE','$.cards[*].home');
    v=clone(rich);delete v.cards[0].home;check(v,'SCHEMA_REQUIRED','$.cards[*].home');
    v=clone(rich);v.cards[0].unexpected_payload_key='sensitive';check(v,'SCHEMA_UNKNOWN_FIELD','$.cards[*]');
    v=clone(rich);v.cards[0].updated_at='2026-11-27T99:00:00Z';check(v,'SCHEMA_TIMESTAMP','$.cards[*].updated_at');
    v=clone(base);v.records.engine=example({...schema.properties.records.properties.engine,nullable:false});v.records.engine.key='engine';v.records.engine.payload.days={'sensitive-map-key':{}};check(v,'SCHEMA_MAP_KEY','$.records.engine.payload.days.*');
   });
   await t.test(profile+': relational card, probability, board and slip failures identify fixed reasons',()=>{
    let v=clone(rich);v.cards.push(clone(card));check(v,'CARDS_DUPLICATE','$.cards');
    v=clone(rich);v.cards[0].prediction=example({...schema.properties.cards.items.properties.prediction,nullable:false});v.cards[0].prediction.p_home=0.1;v.cards[0].prediction.p_draw=0.1;v.cards[0].prediction.p_away=0.1;check(v,'PREDICTION_PROBABILITY_VECTOR');
    v=clone(rich);v.board=example({...schema.properties.board,nullable:false});v.board.n=1;check(v,'BOARD_COUNT');
    const bs=schema.properties.board.properties.rows.items,row=example(bs);Object.assign(row,{f:card.fxid,l:card.lid,h:card.home,a:card.away});
    v=clone(rich);v.board=example({...schema.properties.board,nullable:false});v.board.rows=[clone(row)];v.board.n=1;assert.equal(check(v,'VALID').accepted,true);
    v.board.rows[0].f=999;check(v,'BOARD_REFERENCE');v.board.rows[0]=clone(row);v.board.rows[0].h='private-wrong-identity';check(v,'BOARD_IDENTITY');
    const slip=example(schema.properties.slips.items);slip.tier='tips';const leg=example(schema.properties.slips.items.properties.legs.items);Object.assign(leg,{tab:'winner',rank:0});slip.legs=[leg];v=clone(rich);v.slips=[slip];assert.equal(check(v,'VALID').accepted,true);v.slips[0].legs[0].fxid=999;check(v,'SLIP_REFERENCE');v.slips[0].legs[0].fxid=card.fxid;v.slips[0].legs[0].tab='unknown';check(v,'TIPS_TAB_OR_RANK');
   });
   await t.test(profile+': corruption and outer bounds never leak rejected values or weaken acceptance',()=>{
    for(const v of [null,{},[],{cards:'sensitive'},...['cards','board','records','slips'].map(k=>{let v=clone(base);delete v[k];return v;})])assert.equal(check(v).accepted,false);
    let v=clone(base);v.cards=Array.from({length:schema.properties.cards.max+1},()=>clone(card));check(v,'SCHEMA_ARRAY_BOUND','$.cards');
    v=clone(base);v.sensitive='sensitive'.repeat(Number(profile==='production'?4194304:2097152)/9+1);check(v,'PAYLOAD_BYTES','$');
   });
   await t.test(profile+': actual materializer rejection emits private DETAIL and rolls back publication',()=>{
    let failed;try{sql(db,'select mm_fixture_delivery.materialize();');}catch(e){failed=e;}assert.ok(failed);assert.match(failed.stderr,/Presentation validation failed/);assert.match(failed.stderr,/SCHEMA_STRING_LENGTH/);assert.match(failed.stderr,/\$\.cards\[\*\]\.home/);assert.doesNotMatch(failed.stderr,/private-home-sentinel|x{100}/);assert.equal(sql(db,'select count(*) from mm_fixture_delivery.editions;'),'0');
    sql(db,"update public.fixtures set home='private-home-sentinel';");const made=JSON.parse(sql(db,'select mm_fixture_delivery.materialize();'));assert.equal(made.cards,1);assert.equal(sql(db,'select count(*) from mm_fixture_delivery.editions;'),'1');
    sql(db,"update public.fixtures set home=repeat('x',161);");assert.throws(()=>sql(db,'select mm_fixture_delivery.materialize();'),/Presentation validation failed/);assert.equal(sql(db,'select count(*) from mm_fixture_delivery.editions;'),'1');
   });
   await t.test(profile+': private invoker access, source drift and materializer detail contract',()=>{
    for(const role of ['anon','authenticated'])assert.throws(()=>sql(db,'set role '+role+';select mm_publication_diagnostics.inspect('+json(base)+');'),/permission denied/);
    assert.equal(JSON.parse(sql(db,'set role service_role;select mm_publication_diagnostics.inspect('+json(base)+');')).accepted,true);
    const m=sql(db,"select pg_get_functiondef('mm_fixture_delivery.materialize()'::regprocedure);");assert.match(m,/errcode='MMV01',detail=mm_publication_diagnostics.inspect\(built\)::text/);if(profile==='production'){assert.match(m,/3000-card bound/);assert.match(m,/4 MiB bound/);}
    sql(db,"create or replace function mm_fixture_delivery.payload_valid(v jsonb)returns boolean language sql immutable as $$select false$$;");const drift=inspect(base);assert.equal(drift.code,'VALIDATOR_SOURCE_DRIFT');assert.notEqual(drift.validator_sha256,profiles[profile].payload_valid);assert.throws(()=>sql(db,requireSQL(candidate)),/source drift/);
   });
  }
 }finally{if(started)docker(['rm','-f',name]);await rm(dir,{recursive:true,force:true});}
});
// Sync read only for the rejected install transaction assertion above.
import {readFileSync} from 'node:fs';
const requireSQL=p=>readFileSync(p,'utf8');
