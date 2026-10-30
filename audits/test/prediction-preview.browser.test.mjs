import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {chromium} from 'playwright-core';
const root=new URL('../prediction-preview/',import.meta.url);
test('isolated preview renders honest engine-only and all synthetic AI states without external requests',async()=>{
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking']});
 try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url()),name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   if(url.origin!=='http://matchmind-preview.test'||!['index.html','app.mjs','model.mjs','data.mjs','styles.css'].includes(name)){external.push(url.href);return route.abort();}
   return route.fulfill({status:200,body:readFileSync(new URL(name,root)),contentType:name.endsWith('.css')?'text/css':name.endsWith('.mjs')?'text/javascript':'text/html'});
  });
  await page.goto('http://matchmind-preview.test/');await page.getByRole('heading',{name:'Santos vs Palmeiras',exact:true}).waitFor();
  assert.equal(await page.title(),'MatchMind — Prediction comparison preview');
  const panel=page.getByRole('region',{name:'Independent AI analysis'});
  assert.ok((await panel.innerText()).includes('UNAVAILABLE'));assert.ok((await page.getByRole('region',{name:'MatchMind final decision'}).innerText()).includes('Final decision unavailable'));
  assert.equal(await page.locator('.engine-value').allTextContents().then(x=>x.join('|')),'Engine 23.63%|Engine 28.33%|Engine 48.04%');
  assert.deepEqual(await page.locator('.ai-value').allTextContents(),['AI —','AI —','AI —']);
  assert.equal(await page.locator('#state-control').isVisible(),false);
  await page.getByText('Supporting evidence & record identity',{exact:true}).click();assert.ok((await page.locator('#source-evidence').innerText()).includes('2026-10-28T05:19:00.304Z'));
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'genuine overflow at '+width);}
  await page.getByLabel('Preview example',{exact:true}).selectOption('demo');assert.equal(await page.locator('#demo-notice').isVisible(),true);assert.ok((await panel.innerText()).includes('simulated'));
  assert.deepEqual(await page.locator('.ai-value').allTextContents(),['AI 46.00%','AI 29.00%','AI 25.00%']);
  assert.ok((await page.getByRole('region',{name:'MatchMind final decision'}).innerText()).includes('SYNTHETIC ONLY'));
  await page.locator('.citations a').first().click();assert.equal(await page.locator('#source-evidence').getAttribute('open'),'');
  for(const state of ['pending','unavailable','failed','abstained']){
   await page.getByLabel('Synthetic AI state',{exact:true}).selectOption(state);
   assert.ok((await panel.innerText()).includes(state.toUpperCase()));assert.deepEqual(await page.locator('.ai-value').allTextContents(),['AI —','AI —','AI —']);
   assert.equal(await page.locator('.analysis').count(),0);assert.equal(await page.locator('#demo-notice').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.getByLabel('Synthetic AI state',{exact:true}).selectOption('available');await page.setViewportSize({width:320,height:780});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByLabel('Preview example',{exact:true}).selectOption('santos');assert.equal(await page.locator('#demo-notice').isVisible(),false);assert.deepEqual(await page.locator('.ai-value').allTextContents(),['AI —','AI —','AI —']);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
 }finally{await browser.close();}
});
