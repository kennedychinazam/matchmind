// Production compatibility variant of the development client, for the CURRENT production
// backend (toqfdrcjzwnlydqekude) which has no matchmind_fixture_access_v1 / matchmind_display_v1.
//
// WHAT IT DOES: the bounded presentation is replaced by the exact data path Build 355 uses on
// origin/main today: direct PostgREST reads (and the publisher robot's RLS-gated writes) of
// fixtures, fixtures_lean, competitions, predictions, daily_slips, odds_snapshots, odds_latest,
// shared_records and predictions_retired. Authority stays where 355 has it: production RLS.
//
// WHAT IT DOES NOT DO: it does not change index.html in the repository, the staging transforms,
// or any database object. The development client's bounded boundary remains the source of truth.
//
// TRADE-OFF (PROVIDER-DATA-EXPOSURE.md): this variant serves provider-origin fixture rows to any
// anonymous visitor, exactly as live Build 355 does. It adds no exposure beyond what production
// serves today, but it IS the exposure that document flags as gating external release. Publishing
// this variant is a Director decision, not a technical default.
//
// Usage: node release/production-compat/build.mjs <out-dir>
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const PROD_URL="const SUPA_URL = 'https://toqfdrcjzwnlydqekude.supabase.co';";
export const MARKER='direct-355-compat';
const once=(s,a,b,label)=>{const n=s.split(a).length-1;if(n!==1)throw Error(`production compat anchor ${label} matched ${n} times`);return s.replace(a,()=>b);};
export function compatTransform(html){
 if(html.split(PROD_URL).length!==2)throw Error('production compat refused: SUPA_URL is not the production project');
 if(/stagingGuard|realPreviewGuard|rdcbnvfnxenrpnnwxszs/.test(html))throw Error('production compat refused: input is a staging/preview artifact');
 const eol=html.includes('\r\n')?'\r\n':'\n';
 const start=html.indexOf('async function fixtureAccess(){'),end=html.indexOf('function fixtureText(',start);
 if(start<0||end<start||html.indexOf('async function fixtureAccess(){',start+1)>=0)throw Error('production compat anchor fixtureAccess changed');
 const access=[
  `/* PRODUCTION COMPAT (${MARKER}): the production backend has no bounded fixture-access RPC.`,
  `   Source rows are read directly under production RLS, as Build 355 does. No RPC is called. */`,
  `const MM_FIXTURE_DELIVERY='${MARKER}';`,
  `async function fixtureAccess(){return !!supa;}`,''].join(eol);
 html=html.slice(0,start)+access+html.slice(end);
 html=once(html,'function fixtureRawCurrent(){const c=_fixtureDelivery;return !!(c.rawAllowed&&fixtureDeliveryCurrent(c)&&c.expiresAt>Date.now());}',
  'function fixtureRawCurrent(){return !!supa;}','fixtureRawCurrent');
 html=once(html,"async function fixtureDisplayLoad(screen){","async function fixtureDisplayLoad(screen){throw Error('Bounded display is not installed on this backend');","fixtureDisplayLoad");
 // The display RPC text remains only as unreachable code after the unconditional throw above.
 if(/matchmind_fixture_access_v1/.test(html))throw Error('production compat: bounded access RPC call survived');
 return html;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('usage: build.mjs <out-dir>');
 mkdirSync(out,{recursive:true});
 const html=compatTransform(readFileSync(join(root,'index.html'),'utf8'));
 writeFileSync(join(out,'index.html'),html);
 for(const f of ['sw.js','manifest.webmanifest','icon-192.png','icon-512.png'])copyFileSync(join(root,f),join(out,f));
 const digest={};for(const f of ['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png'])digest[f]=createHash('sha256').update(readFileSync(join(out,f))).digest('hex');
 console.log(JSON.stringify({variant:MARKER,out,sha256:digest},null,1));
}
