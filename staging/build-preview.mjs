/* Build the Build 358 STAGING PREVIEW from the immutable release candidate.
 *
 *   node staging/build-preview.mjs [outDir]        (default: staging/dist)
 *
 * The release candidate files are never edited. This reads them, applies exactly the
 * replacements below (each must match exactly once or the build refuses), and writes a
 * separate output directory. sw.js and the icons are copied byte for byte.
 *
 * What changes, and nothing else:
 *   1. SUPA_URL / SUPA_KEY point at the STAGING project rdcbnvfnxenrpnnwxszs and its publishable key.
 *   2. A guard script runs first in <head>. It refuses any network request whose host is not
 *      the staging project, the page's own origin, Google Fonts or the supabase-js CDN; it
 *      refuses every /functions/ call (AI analysis, account deletion), and it makes push
 *      subscription impossible.
 *   3. A visible STAGING bar, and a STAGING title and installed-app name.
 * The production project reference and its key must not occur anywhere in the output; the
 * build checks that itself and the offline test checks it again.
 */
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(ROOT, 'staging/dist'));
export const STAGING_REF = 'rdcbnvfnxenrpnnwxszs';
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
export const STAGING_KEY = 'sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const PROD_REF = 'toqfdrcjzwnlydqekude', PROD_KEY_FRAGMENT = 'wrXk5NFfWkrCdLgiQsaMHg';

const sha = b => createHash('sha256').update(b).digest('hex');
const once = (s, from, to, label) => {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`staging build refused: "${label}" matched ${n} times, expected exactly 1`);
  return s.replace(from, () => to);
};

const GUARD = `<script id="stagingGuard">(function(){
 var ALLOW=['${STAGING_REF}.supabase.co','fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net'];
 function hostOk(u){try{var h=new URL(u,location.href);if(h.origin===location.origin)return true;
  if(h.hostname==='${STAGING_REF}.supabase.co'&&h.pathname.indexOf('/functions/')===0)return false;
  return ALLOW.indexOf(h.hostname)>=0;}catch(e){return false;}}
 function refuse(u){try{console.warn('[staging preview] blocked request: '+u);}catch(e){}}
 var rf=window.fetch;
 window.fetch=function(i){var u=typeof i==='string'?i:(i&&i.url)||String(i);
  if(!hostOk(u)){refuse(u);return Promise.reject(new TypeError('Blocked in the staging preview: '+u));}
  return rf.apply(this,arguments);};
 var xo=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(m,u){if(!hostOk(u)){refuse(u);throw new TypeError('Blocked in the staging preview: '+u);}return xo.apply(this,arguments);};
 if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon=function(u,d){if(!hostOk(u)){refuse(u);return false;}return sb(u,d);};}
 if(window.PushManager&&PushManager.prototype){
  PushManager.prototype.subscribe=function(){return Promise.reject(new DOMException('Push is disabled in the staging preview','NotAllowedError'));};}
 window.__MM_STAGING__={ref:'${STAGING_REF}',build:358};
 document.addEventListener('DOMContentLoaded',function(){
  var b=document.createElement('div');b.id='stagingBar';
  b.textContent='STAGING \\u00b7 Build 358 \\u00b7 synthetic data \\u00b7 not production';
  b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;height:14px;line-height:14px;font:700 9px/14px system-ui,sans-serif;letter-spacing:.04em;text-align:center;background:#d97706;color:#111;pointer-events:none;white-space:nowrap;overflow:hidden';
  document.body.appendChild(b);});
})();</script>`;

export function transform(index, manifest) {
  const crlf = index.includes('\r\n');
  let html = index;
  html = once(html, `https://${PROD_REF}.supabase.co`, STAGING_URL, 'SUPA_URL');
  html = html.replace(/const SUPA_KEY = '[^']*';/, m => { return `const SUPA_KEY = '${STAGING_KEY}';`; });
  if (!html.includes(STAGING_KEY)) throw new Error('staging build refused: SUPA_KEY was not replaced');
  html = once(html, '<head>', '<head>' + (crlf ? '\r\n' : '\n') + GUARD, '<head>');
  html = once(html, '<title>MatchMind PRO', '<title>STAGING MatchMind PRO', '<title>');
  const man = JSON.parse(manifest);
  man.name = 'MatchMind STAGING'; man.short_name = 'MM Staging';
  return {html, manifest: JSON.stringify(man, null, 2) + '\n'};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const read = f => readFileSync(join(ROOT, f));
  const src = {index: read('index.html'), sw: read('sw.js'), manifest: read('manifest.webmanifest'), i192: read('icon-192.png'), i512: read('icon-512.png')};
  const t = transform(src.index.toString('utf8'), src.manifest.toString('utf8'));
  mkdirSync(out, {recursive: true});
  writeFileSync(join(out, 'index.html'), t.html);
  writeFileSync(join(out, 'manifest.webmanifest'), t.manifest);
  for (const f of ['sw.js', 'icon-192.png', 'icon-512.png']) copyFileSync(join(ROOT, f), join(out, f));
  const all = [t.html, t.manifest, src.sw.toString('latin1')].join('\n');
  for (const bad of [PROD_REF, PROD_KEY_FRAGMENT, 'service_role', 'sb_secret_'])
    if (all.includes(bad)) throw new Error('staging build refused: output contains ' + bad);
  const info = {
    build: 358, staging_project: STAGING_REF, supabase_url: STAGING_URL, publishable_key_prefix: STAGING_KEY.slice(0, 16),
    source_sha256: {'index.html': sha(src.index), 'sw.js': sha(src.sw), 'manifest.webmanifest': sha(src.manifest)},
    output_sha256: {'index.html': sha(Buffer.from(t.html)), 'sw.js': sha(src.sw), 'manifest.webmanifest': sha(Buffer.from(t.manifest)),
                    'icon-192.png': sha(src.i192), 'icon-512.png': sha(src.i512)},
    changes: ['SUPA_URL and SUPA_KEY to staging', 'staging guard script in <head>', 'title prefix STAGING', 'manifest name and short_name'],
  };
  writeFileSync(join(out, 'BUILD-INFO.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(JSON.stringify(info, null, 2));
}
