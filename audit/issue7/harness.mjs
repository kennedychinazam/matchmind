/* Issue #7 forensic harness. READ-ONLY.
   Loads the unmodified Build 355 index.html in Chromium and calls its own engine functions on
   synthetic, deterministic corpora. No network, no provider, no Supabase, no archive, no real
   fixture. Nothing it prints is a claim about any real match. */
import {createServer} from 'node:http';
import {readFileSync, existsSync} from 'node:fs';
import {join, extname} from 'node:path';
import {createRequire} from 'node:module';

/* Resolve Chromium from whatever the host already has, in this order, downloading nothing.
   The first version of this file hardcoded a cloud-specific absolute path while the README
   claimed flexible resolution. The Director's review caught the inconsistency; this is the fix. */
function loadChromium(){
  const require = createRequire(import.meta.url);
  for(const id of ['playwright','playwright-core','/opt/node-tools/node_modules/playwright/index.js']){
    try{ return require(id).chromium; }catch{}
  }
  throw Error('no playwright or playwright-core on this host');
}
function browserPath(){
  for(const p of [process.env.MM_TEST_CHROMIUM, '/opt/pw-browsers/chromium',
                  '/usr/bin/chromium', '/usr/bin/google-chrome'])
    if(p && existsSync(p)) return p;
  return undefined;   // let playwright use its own bundled browser if it has one
}
const chromium = loadChromium();

const ROOT = process.argv[2] || '.';
const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};

export async function openEngine(){
  const srv = createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p === '/') p = '/index.html';
    const f = join(ROOT, p);
    if(!f.startsWith(ROOT) || !existsSync(f)){ res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'});
    res.end(readFileSync(f));
  });
  await new Promise(ok=>srv.listen(0,'127.0.0.1',ok));
  const port = srv.address().port;
  const browser = await chromium.launch({executablePath: browserPath(),
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  const ctx = await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:'+port) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:'+port+'/', {waitUntil:'load', timeout:60000});
  await page.waitForFunction(()=>typeof footballEngine !== 'undefined' && typeof xcAdjust === 'function',
    null, {timeout:60000});
  return {page, close: async()=>{ await browser.close(); srv.close(); }};
}

/* Helpers injected into the page. Deterministic: no Math.random, no Date.now in any corpus. */
export const PAGE_HELPERS = `
  // A fixture row in the shape loadCloudLeagues builds (index.html:19139).
  globalThis.mkMatch = (date, home, away, hg, ag) =>
    ({date, time:'19:45', home, away, hg, ag, hth:0, hta:0,
      ft_h:hg, ft_a:ag, fgh:null, fga:null, pgh:null, pga:null});

  // Register a synthetic competition so historyLeagues()/xcIndex() can see it, and so the
  // cup-vs-league shrink is applied exactly as the app applies it.
  globalThis.mkLeague = (id, name, matches) => {
    const L = {id, name, country:'Synthetic', sport:'football', matches};
    afState.leagues[id] = L;
    if((afState.leagueOrder||[]).indexOf(id) < 0) (afState.leagueOrder = afState.leagueOrder||[]).push(id);
    registerLeagueDampen(L);
    return L;
  };
  globalThis.resetLeagues = () => { afState.leagues = {}; afState.leagueOrder = [];
    try{ _xcIx = null; _xcIxTag = ''; }catch(e){} };

  // A round-robin league that is DETERMINISTIC and parameterised by goals per game.
  // Every team plays every other home and away; \`strong\` scores more.
  globalThis.roundRobin = (teams, startDate, perGame, spread) => {
    const out = []; let d = new Date(startDate + 'T00:00:00Z');
    for(let i=0;i<teams.length;i++) for(let j=0;j<teams.length;j++){
      if(i===j) continue;
      const hi = (teams.length-1-i)/Math.max(1,teams.length-1);   // 1 = strongest
      const ai = (teams.length-1-j)/Math.max(1,teams.length-1);
      const hg = Math.max(0, Math.round(perGame*(1+spread*(hi-0.5))));
      const ag = Math.max(0, Math.round(perGame*(1+spread*(ai-0.5))));
      out.push(mkMatch(d.toISOString().slice(0,10), teams[i], teams[j], hg, ag));
      d = new Date(d.getTime() + 3*86400000);
    }
    return out;
  };

  // Fit a competition and price one fixture through the app's own published path.
  globalThis.priceFixture = (L, home, away, date) => {
    const f = {date, time:'19:45', home, away, fxid:999999};
    const tmp = Object.create(footballEngine); tmp.matches = L.matches;
    const base = tmp.predict(home, away);
    const adj = xcAdjust(L, f, base, tmp);
    const s = tmp.strengths();
    return {
      base: base && {pW:base.pW, pD:base.pD, pL:base.pL, lambdaH:base.lambdaH, lambdaA:base.lambdaA},
      adjusted: adj && {pW:adj.pW, pD:adj.pD, pL:adj.pL, lambdaH:adj.lambdaH, lambdaA:adj.lambdaA,
                        xcShift: adj.xcShift===undefined?null:adj.xcShift},
      changed: !!(base && adj && (base.pW !== adj.pW)),
      avgH: s.avgH, avgA: s.avgA,
      ratingH: s.teams[home] || null, ratingA: s.teams[away] || null
    };
  };
`;
