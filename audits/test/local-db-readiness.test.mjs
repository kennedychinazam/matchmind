import test from 'node:test';
import assert from 'node:assert/strict';
import * as local from '../test-support/local-db.mjs';

test('database readiness ignores the temporary Unix-socket initialization server',async()=>{
 assert.equal(typeof local.waitForPostgres,'function');
 let probes=0,queries=0,pauses=0;
 const command=(args,input)=>{
  assert.deepEqual(args.slice(0,2),['exec','-i']);
  assert.equal(args[2],'synthetic-db');
  if(args[3]==='pg_isready'){
   assert.deepEqual(args.slice(4),['-h','127.0.0.1','-U','postgres','-d','matchmind_test']);
   if(++probes<3)throw Error('TCP unavailable during initialization and restart');
   return 'accepting connections';
  }
  assert.equal(args[3],'psql');assert.equal(input,'select 1');
  queries++;return '1\n'; // The temporary server would also answer this query.
 };
 await local.waitForPostgres('synthetic-db',command,async()=>{pauses++;});
 assert.equal(probes,3);assert.equal(queries,1);assert.equal(pauses,2);
});

test('database readiness requires a successful SQL query after TCP readiness and stops on exhaustion',async()=>{
 assert.equal(typeof local.waitForPostgres,'function');
 let probes=0,queries=0;
 await local.waitForPostgres('synthetic-db',args=>{
  if(args[3]==='pg_isready'){probes++;return 'accepting connections';}
  if(++queries===1)throw Error('startup not complete');
  return '1';
 },async()=>{});
 assert.equal(probes,2);assert.equal(queries,2);
 let attempts=0;
 await assert.rejects(()=>local.waitForPostgres('synthetic-db',()=>{attempts++;throw Error('never ready');},async()=>{}),/local PostgreSQL startup failed/);
 assert.equal(attempts,100);
});
