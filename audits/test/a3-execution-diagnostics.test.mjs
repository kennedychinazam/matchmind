import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {phaseTrace,observeExecution,safeDiagnostic,observedFailure} from '../a3-supervised/diagnostics.mjs';
const AT='2026-10-27T12:00:00Z';
function fixture(){const rows=[],trace=phaseTrace(()=>AT,row=>rows.push(row));return{trace,rows};}
test('HTTP error status is retained independently of private response body',()=>{
 const {trace,rows}=fixture();assert.throws(()=>observeExecution(()=>'private provider body secret\n429',trace),e=>{assert.deepEqual(safeDiagnostic(e),{code:'provider_http_status',transport_exit_status:0,http_status:429});return true;});
 assert.equal(rows.at(-1).http_state,'response_status_observed');assert.equal(rows.at(-1).phase,'provider_response_handling');assert.ok(!JSON.stringify(rows).includes('secret'));
});
test('a genuine local subprocess nonzero exit retains only safe exit and observed HTTP status',()=>{
 const {trace,rows}=fixture();assert.throws(()=>observeExecution(()=>execFileSync(process.execPath,['-e',"process.stdout.write('private-body\\n502');process.stderr.write('private-secret');process.exit(7)"],{encoding:'utf8',stdio:['pipe','pipe','pipe']}),trace),e=>{assert.deepEqual(safeDiagnostic(e),{code:'transport_execution_failed',transport_exit_status:7,http_status:502});return true;});
 assert.equal(rows.at(-1).http_state,'response_status_observed');assert.ok(!JSON.stringify(rows).includes('private-'));
});
test('connection or subprocess failure without HTTP status remains transmission unknown',()=>{
 const {trace,rows}=fixture();assert.throws(()=>observeExecution(()=>{const e=Error('secret');e.status=28;e.stdout='private\n000';e.stderr='private';throw e;},trace),e=>{assert.deepEqual(safeDiagnostic(e),{code:'transport_execution_failed',transport_exit_status:28});return true;});assert.equal(rows.at(-1).http_state,'execution_entered_transmission_unknown');
});
test('malformed response preserves observed HTTP 200 without exposing its contents',()=>{
 const {trace}=fixture();assert.throws(()=>observeExecution(()=>'sensitive invalid JSON\n200',trace),e=>{assert.deepEqual(safeDiagnostic(e),{code:'provider_response_json_invalid',transport_exit_status:0,http_status:200});return true;});
});
test('structured response handling does not invent generation receipt evidence',()=>{
 const {trace,rows}=fixture();assert.deepEqual(observeExecution(()=>'{"test":"synthetic"}\n200',trace),{test:'synthetic'});assert.equal(rows.at(-1).http_state,'response_status_observed');assert.equal(rows.some(r=>r.http_transmission_confirmed===true),false);
});
test('malicious error properties, messages and arbitrary status objects cannot enter diagnostics',()=>{
 const {trace}=fixture();const e=Error('Bearer sk-secret private request');e.diagnostic={code:'leak',body:'private'};e.status=401;e.http_status=400;
 const row=trace.failure(e);assert.equal(row.code,'unclassified_failure');assert.equal(row.http_status,undefined);assert.ok(!JSON.stringify(row).includes('private'));
 assert.deepEqual(safeDiagnostic(observedFailure('not safe',{exit_status:999,http_status:999,signal:'secret'})),{code:'unclassified_failure'});
});
test('failure recording is fail-closed when the durable observer fails',()=>{
 const trace=phaseTrace(()=>AT,()=>{throw Error('filesystem secret');});assert.throws(()=>observeExecution(()=>{assert.fail('must not execute');},trace));
});
test('deadline admission is rechecked after durable pre-HTTP observations and before subprocess entry',()=>{
 const rows=[];let now=0,calls=0;const trace=phaseTrace(()=>AT,row=>{rows.push(row);now++;});
 assert.throws(()=>observeExecution(()=>{calls++;return '{}\n200';},trace,()=>{assert.ok(now>0);throw Error('authorization_or_source_expired_immediately_before_http');}),/expired_immediately_before_http/);
 assert.equal(calls,0);assert.equal(rows.at(-1).http_state,'not_started');
});
test('phase names are closed and cannot become a private-text diagnostic channel',()=>{
 const {trace,rows}=fixture();assert.throws(()=>trace.enter('Bearer sk-private request payload'),/invalid_diagnostic_phase/);assert.equal(rows.length,0);
});
test('trusted error classifications cannot be mutated into an unsafe diagnostic payload',()=>{
 const error=observedFailure('provider_http_status',{http_status:429});
 assert.throws(()=>{safeDiagnostic(error).code='Bearer sk-private';},TypeError);
 assert.equal(fixture().trace.failure(error).code,'provider_http_status');
});
