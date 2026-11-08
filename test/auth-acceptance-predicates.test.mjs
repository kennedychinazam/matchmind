/* NEGATIVE CONTROLS for the staging acceptance decision rules.
 *
 * Director review of 8 November 2026: "Add negative controls that intentionally simulate 200 with
 * a non-array body or a server-error response and require the harness to reject the bogus
 * 'denial'." These run offline, in the ordinary Node suite, with no network and no staging key,
 * so the rules are proven before the key is ever installed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, isGenuineDenial, isGenuineRead, isExplicitlyUnauthorized, explain}
  from '../backend/fixture-delivery/acceptance-predicates.mjs';

const res = (status, data) => ({status, data});

test('a denial is only an authorization refusal or an empty array', () => {
  assert.equal(isGenuineDenial(res(401, {message: 'JWT expired'})), true);
  assert.equal(isGenuineDenial(res(403, {message: 'permission denied'})), true);
  assert.equal(isGenuineDenial(res(200, [])), true);
  assert.equal(isGenuineDenial(res(200, [{fxid: 1}])), false, 'rows came back');
});

test('NEGATIVE CONTROL: a 200 carrying a non-array body is not a denial', () => {
  /* The exact shape the old assertion accepted: !(200 && isArray && length>0) was true here,
     so a body full of rows under another key read as "denied". */
  for (const body of [{rows: [{fxid: 1}]}, {}, null, 'OK', 0, {count: 148}]) {
    assert.equal(isGenuineDenial(res(200, body)), false,
      'accepted a non-array 200 as a denial: ' + JSON.stringify(body));
    assert.equal(classify(res(200, body)), 'malformed');
  }
});

test('NEGATIVE CONTROL: a server error is not a denial', () => {
  for (const s of [500, 502, 503, 504]) {
    assert.equal(isGenuineDenial(res(s, {message: 'upstream down'})), false, 'accepted ' + s);
    assert.equal(classify(res(s, null)), 'server_error');
  }
});

test('NEGATIVE CONTROL: an unrelated 4xx is not an authorization denial', () => {
  for (const s of [400, 404, 405, 429]) {
    assert.equal(isGenuineDenial(res(s, {message: 'nope'})), false, 'accepted ' + s + ' as denial');
    assert.equal(isExplicitlyUnauthorized(res(s, {})), false, 'accepted ' + s + ' as unauthorized');
  }
});

test('NEGATIVE CONTROL: a missing or malformed response object is never a pass', () => {
  for (const bad of [undefined, null, {}, {status: 'x'}, {data: []}]) {
    assert.equal(isGenuineDenial(bad), false);
    assert.equal(isGenuineRead(bad), false);
    assert.equal(isExplicitlyUnauthorized(bad), false);
    assert.equal(classify(bad), 'unusable');
  }
});

test('a tampered token must be refused explicitly, not merely filtered to nothing', () => {
  assert.equal(isExplicitlyUnauthorized(res(401, {message: 'invalid signature'})), true);
  assert.equal(isExplicitlyUnauthorized(res(403, {message: 'forbidden'})), true);
  /* An empty 200 means the token was ACCEPTED and RLS filtered the rows. For a forged token that
     is the wrong outcome, and the old assertion called it a pass. */
  assert.equal(isExplicitlyUnauthorized(res(200, [])), false,
    'an accepted-but-filtered forged token must not count as rejected');
  assert.equal(isExplicitlyUnauthorized(res(500, {})), false);
});

test('a genuine read is a non-empty array and nothing else', () => {
  assert.equal(isGenuineRead(res(200, [{a: 1}])), true);
  assert.equal(isGenuineRead(res(200, [])), false);
  assert.equal(isGenuineRead(res(200, {rows: [{a: 1}]})), false);
  assert.equal(isGenuineRead(res(401, [])), false);
});

test('explain() names the classification, so a failure message is readable', () => {
  assert.match(explain(res(500, {message: 'boom'})), /classified server_error/);
  assert.match(explain(res(200, {rows: 1})), /classified malformed/);
  assert.match(explain(res(200, [])), /classified empty/);
  assert.doesNotThrow(() => explain(undefined));
});

/* Independent review of 8 November 2026 killed 9 of 12 mutants of the rules above with these
   controls, but survived one that removed explain()'s own guard: nothing fed it a body that
   cannot be serialised, so a future simplification could turn every failure message into a
   crash that masks the real finding. These two controls close that. */
test('NEGATIVE CONTROL: explain() never throws, whatever the body is', () => {
  const circular = {}; circular.self = circular;
  assert.doesNotThrow(() => explain({status: 200, data: circular}));
  assert.match(explain({status: 200, data: circular}), /unserialisable/);
  assert.doesNotThrow(() => explain({status: 200, data: {n: 1n}}));
  assert.match(explain({status: 200, data: {n: 1n}}), /unserialisable/);
  assert.doesNotThrow(() => explain({status: 200, data: {toJSON() { throw Error('no'); }}}));
  assert.doesNotThrow(() => explain(new Proxy({}, {get() { throw Error('hostile'); }})));
  assert.doesNotThrow(() => explain(undefined));
  assert.doesNotThrow(() => explain('not a response'));
});

test('explain() redacts bearer credentials out of a token response', () => {
  const out = explain({status: 200, data: {
    access_token: 'eyJhbGciOiJIUzI1NiJ9.PAYLOAD.SIGNATURE',
    refresh_token: 'r-abc123', token_type: 'bearer', expires_in: 3600}});
  assert.ok(!out.includes('eyJhbGciOiJIUzI1NiJ9'), out);
  assert.ok(!out.includes('r-abc123'), out);
  assert.match(out, /redacted/);
});
