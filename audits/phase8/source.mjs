// Opt-in read-only public Data API export. Never invokes an Edge Function or RPC.
import {execFileSync}from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync}from 'node:fs';
import {tmpdir}from 'node:os';
import {join}from 'node:path';
import {canonicalHash}from '../lib/snapshot-contract.mjs';
import {ENGINE_COMP_IDS}from './engine.mjs';
const ROOT='https://toqfdrcjzwnlydqekude.supabase.co/rest/v1/';
const TABLES=new Set(['fixtures','competition_measures','predictions','odds_snapshots']);
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const publicKey=source.match(/const SUPA_KEY = '([^']+)'/)[1]; // Already public; no service-role key.
const FIELDS='fxid,lid,lname,lcountry,season,date,time,status,home,away,gh,ga,ht_h,ht_a,ft_h,ft_a,provider,xg_h,xg_a,inj_h,inj_a';
export function sourceURL(table,parameters){
 if(!TABLES.has(table))throw Error('source table is not read-only allowlisted');
 const url=new URL(ROOT+table);for(const[k,v]of Object.entries(parameters))url.searchParams.set(k,String(v));return url.href;
}
export function readSource(table,parameters,{count=false}={}){
 const scratch=mkdtempSync(join(tmpdir(),'mm-phase8-read-'));
 try{
  const args=['--silent','--show-error','--fail','--max-time','30','--max-filesize','52428800','--proto','=https','--request','GET','--dump-header',join(scratch,'headers'),'-H','apikey: '+publicKey];
  if(count)args.push('-H','Prefer: count=exact');args.push(sourceURL(table,parameters));
  const body=execFileSync('curl',args,{encoding:'utf8',maxBuffer:50*1024*1024,timeout:35000});
  const headers=readFileSync(join(scratch,'headers'),'utf8'),range=headers.match(/content-range:\s*[^\r\n]*\/(\d+)/i),date=headers.match(/^date:\s*(.+)$/im);
  const rows=JSON.parse(body);if(!Array.isArray(rows))throw Error('source response is not an array');
  return{rows,total:range?Number(range[1]):null,server_date:date?new Date(date[1].trim()).toISOString():null,received_at_utc:new Date().toISOString(),body_hash:canonicalHash(rows)};
 }catch{throw Error('read-only source request failed; no retry or partial success');}
 finally{rmSync(scratch,{recursive:true,force:true});}
}
export async function collectPages(fetchPage,{pageSize=1000,maxBytes=50*1024*1024,idField='fxid'}={}){
 const rows=[],pages=[];let last=0,total=null,bytes=0;
 for(;;){
  const page=await fetchPage(last);
  if(!Array.isArray(page.rows)||!Number.isSafeInteger(page.total)||page.total<0)throw Error('source inventory count absent');
  if(total===null)total=page.total;else if(total!==page.total)throw Error('source count changed during collection');
  pages.push({after_id:last,count:page.rows.length,server_date:page.server_date??null,received_at_utc:page.received_at_utc??null,body_hash:canonicalHash(page.rows)});
  if(!page.rows.length)break;
  for(const row of page.rows){if(!Number.isSafeInteger(row[idField])||row[idField]<=last)throw Error('duplicate or unordered source fixture');last=row[idField];bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>maxBytes)throw Error('complete source exceeds private capacity; not truncated');rows.push(row);}
 }
 if(rows.length!==total)throw Error('incomplete source inventory');return{rows,pages,bytes};
}
export async function collectReadonly({onPage=()=>{}}={}){
 const now=new Date(),cutoff=new Date(now);cutoff.setUTCMonth(cutoff.getUTCMonth()-60);
 const history_cutoff=cutoff.toISOString().slice(0,10),base={select:FIELDS,date:'gte.'+history_cutoff,'and':'(date.lte.2026-10-25)',order:'fxid.asc'},collected={rows:[],pages:[]};let initialCount=0;
 // Existing per-competition reads avoid the failed whole-table count plan.
 // Every fixed engine competition, including empty ones, is still inventoried.
 for(const lid of ENGINE_COMP_IDS){
  const query={...base,lid:'eq.'+lid},initial=readSource('fixtures',{...query,select:'fxid',limit:0},{count:true});if(initial.total===null)throw Error('source inventory unavailable');
  const group=await collectPages(async last=>{const page=readSource('fixtures',{...query,fxid:'gt.'+last,limit:1000});onPage({rows:page.rows.length,after_id:last,lid});return{...page,total:initial.total};});
  const final=readSource('fixtures',{...query,select:'fxid',limit:0},{count:true});if(final.total!==initial.total)throw Error('source inventory changed; whole export rejected');
  initialCount+=initial.total;collected.rows.push(...group.rows);collected.pages.push(...group.pages.map(p=>({...p,lid})));
  if(Buffer.byteLength(JSON.stringify(collected.rows))>50*1024*1024)throw Error('complete source exceeds private capacity');
 }
 const measures=readSource('competition_measures',{select:'lid,gate,skill,data_size,build,computed_at',order:'lid.asc',limit:1000}).rows;
 const originals=readSource('predictions',{select:'fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,market,build,made_at',kickoff:'gte.2026-10-24',and:'(kickoff.lte.2026-10-25)',order:'fxid.asc',limit:1000},{count:true});
 if(originals.total!==originals.rows.length)throw Error('original export incomplete');
 const rows=collected.rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid),at=new Date().toISOString();
 const targets=rows.filter(r=>r.date>='2026-10-24'&&r.date<='2026-10-25'&&r.status==='NS'&&Date.parse(r.date+'T'+r.time+'Z')>Date.parse(at)).map(r=>r.fxid);
 const odds=[];for(let i=0;i<targets.length;i+=50){
  const query={select:'id,fxid,captured_at,mins_to_kick,books,h,d,a',fxid:'in.('+targets.slice(i,i+50).join(',')+')',captured_at:'gte.2026-10-23T00:00:00Z',order:'id.asc'};
  const count=readSource('odds_snapshots',{...query,limit:0},{count:true});
  const group=await collectPages(async last=>({...readSource('odds_snapshots',{...query,id:'gt.'+last,limit:1000}),total:count.total}),{idField:'id'});odds.push(...group.rows);
 }
 const competition_rows=Object.fromEntries(ENGINE_COMP_IDS.map(id=>[id,0]));for(const r of rows)competition_rows[r.lid]++;
 return{schema_version:1,history_cutoff,history_complete:true,scope_competition_ids:[...ENGINE_COMP_IDS],
  inventory:{row_count:rows.length,competition_count:new Set(rows.map(r=>r.lid)).size,history_count:rows.filter(r=>['FT','AET','PEN','FINISHED'].includes(r.status)).length,competition_rows},
  rows,measures,targets,originals:originals.rows,odds,source_read_at_utc:new Date().toISOString(),
  collection:{kind:'receipt_now_readonly_export',atomic_database_snapshot:false,ordering:'date then fixture ID; not historical device-cache reconstruction',pages:collected.pages,initial_count:initialCount,final_count:collected.rows.length,
   provenance:'All pages genuinely read before private ingestion. Mutable provider/update/captured clocks do not establish historical first receipt. Required engine fields complete; unrequested advanced fields explicitly unavailable.'}};
}
