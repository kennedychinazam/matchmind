import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {realPreviewBuild,realPreviewWorker,realTransform} from '../staging/build-real-preview.mjs';
test('real preview labels and worker identity follow the actual candidate build',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8');
 for(const build of [realPreviewBuild(source),999]){
  const candidate=source.replace(/const APP_BUILD\s*=\s*\d+/,`const APP_BUILD = ${build}`),result=realTransform(candidate,manifest);
  assert.ok(result.html.includes(`build:${build}};`));assert.ok(result.html.includes(`READ-ONLY PREVIEW · Build ${build}`));
  assert.ok(realPreviewWorker(build).includes(`mm-real-preview-v${build}-original-logos`));
  assert.doesNotMatch(result.html,/toqfdrcjzwnlydqekude|sb_secret_|service_role/);
 }
});
test('a missing build cannot produce a misleading real-preview identity',()=>{
 assert.throws(()=>realPreviewBuild('<head></head>'),/missing/);
});

test('guest transform preserves deletion safeguards when explanatory comments change',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8');
 const candidate=source.replace('// Acknowledged detachment is also remembered for this SDK client.','// Updated explanatory wording.');
 const result=realTransform(candidate,manifest);
 for(const marker of['const _deletedAccountOwners = new WeakMap();','function accountDeletionRead(owner)','function accountDeletionPrepare(owner)','function accountDeletionDecision(current)'])assert.ok(result.html.includes(marker),marker+' remains after guest initialization replacement');
 const a=result.html.indexOf('function initSupabase(){'),b=result.html.indexOf('const _deletedAccountOwners = new WeakMap();',a);assert.doesNotMatch(result.html.slice(a,b),/cloudPullMerge|signInWithPassword|onAuth\(/);
 assert.throws(()=>realTransform(source+'\nconst _deletedAccountOwners = new WeakMap();',manifest),/Guest init boundary/);
});
