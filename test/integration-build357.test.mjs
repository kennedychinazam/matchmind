/* Build 357 integration safety test. Uses real page code and synthetic score input.
   Runs only on localhost, blocking the internet, Supabase and every paid provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {extname,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let pw=null;
for(const name of ['playwright','playwright-core','/opt/node-tools/node_modules/playwright/index.js']){
  try{pw=require(name);break;}catch{}
}
function browserPath(){
  return [process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome']
    .find(p=>p&&existsSync(p));
}
const path=browserPath();
test('Build 357 and cache version remain aligned',()=>{
  const html=readFileSync(join(ROOT,'index.html'),'utf8');
  const sw=readFileSync(join(ROOT,'sw.js'),'utf8');
  assert.match(html,/const APP_BUILD = 357;/);
  assert.match(sw,/const CACHE = 'matchmind-v357';/);
});
test('published DNB disclosure coexists with unresolved AET protection',async t=>{
  assert.ok(pw&&path,'CI must include Chromium, never skip the integration behavioral test');
  const kinds={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
    '.webmanifest':'application/manifest+json'};
  const server=createServer((req,res)=>{
    const p=decodeURIComponent(req.url.split('?')[0]);
    const f=join(ROOT,p==='/'?'/index.html':p);
    if(!f.startsWith(ROOT)||!existsSync(f)){res.writeHead(404);return res.end('missing');}
    res.writeHead(200,{'content-type':kinds[extname(f)]||'application/octet-stream',
      'service-worker-allowed':'/'});
    res.end(readFileSync(f));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  t.after(()=>server.close());
  const browser=await pw.chromium.launch({executablePath:path,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-sync']});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')
    ?r.continue():r.abort());
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load',timeout:60000});
  const result=await page.evaluate(()=>{
    $('heroConf').textContent='84.8% confidence';
    setHeroDnb('2D',{pW:.125,pD:.175,pL:.70});
    const disclosed=$('heroDnb').textContent;
    const id=991357,fixture={fxid:id,home:'Home',away:'Away',
      date:'2026-10-27',time:'19:45',status:'AET',pick:'2D'};
    const unresolved=settledRow({...fixture,gh:3,ga:2,ft_h:null,ft_a:null});
    const L={matches:[{date:fixture.date,home:fixture.home,away:fixture.away,hg:3,ag:2}]};
    const cells=fxCells(L,fixture,{[id]:unresolved});
    $('heroConf').textContent='';
    setHeroDnb('2D',{pW:.125,pD:.175,pL:.70});
    return {disclosed,dnbHiddenWhenWithheld:$('heroDnb').classList.contains('hidden'),
      noResult:fixtureResult(L,fixture,{[id]:unresolved})===null,
      chip:cells.chip,cell:cells.timeCell,finished:cells.finished};
  });
  assert.match(result.disclosed,/70\.0% win/);
  assert.match(result.disclosed,/17\.5% draw/);
  assert.match(result.disclosed,/12\.5% loss/);
  assert.equal(result.dnbHiddenWhenWithheld,true);
  assert.equal(result.noResult,true);
  assert.equal(result.chip,'','missing 90-minute score must never receive grade');
  assert.match(result.cell,/AET · 90' n\/a/);
  assert.equal(result.finished,true);
});
