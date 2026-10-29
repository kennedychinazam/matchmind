// Illustrative statuses, identities and receipts. Never a historical provider response.
import {readFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSyntheticSession,analyzeCapture,pilotPlan} from './provider-adapter.mjs';
import {safeClone,parseBoundedJSON} from '../a4/bounds.mjs';

export function syntheticPilotExample(retainedRows=null){
 const ids=pilotPlan().fixture_request.fixture_ids;
 const rows=retainedRows===null?ids.map((id,i)=>({fxid:id,lid:81,lname:'Synthetic Cup',lcountry:'Synthetic Country',season:2021,date:'2021-10-26',time:'18:45',home:'Synthetic Home '+i,away:'Synthetic Away '+i,status:'FINISHED',gh:i+1,ga:i,ht_h:0,ht_a:0,ft_h:i+1,ft_a:i,provider:'af'})):safeClone(retainedRows);
 const originals=ids.map((id,i)=>{
  const r=rows.find(x=>x.fxid===id);if(!r)throw Error('example_inventory_missing');
  return {fixture:{id,date:r.date+'T'+r.time+(r.time.length===5?':00Z':'Z'),status:{short:['FT','AET','PEN'][i],long:'Synthetic scenario only',elapsed:120,extra:null}},league:{id:r.lid,name:r.lname,country:r.lcountry,season:r.season},teams:{home:{id:100+i*2,name:r.home},away:{id:101+i*2,name:r.away}},goals:{home:r.gh,away:r.ga},score:{halftime:{home:r.ht_h,away:r.ht_a},fulltime:{home:r.ft_h,away:r.ft_a},extratime:{home:null,away:null},penalty:{home:null,away:null}}};
 });
 const bytes=Buffer.from(' \n'+JSON.stringify({get:'fixtures',parameters:{ids:ids.join('-')},errors:[],results:3,paging:{current:1,total:1},response:originals})+'\n');
 const capture=createSyntheticSession().captureFixture({status:200,headers:{'content-type':'application/json','content-length':String(bytes.length),'x-ratelimit-limit':'450','x-ratelimit-remaining':'449','x-ratelimit-requests-remaining':'70000'},body:bytes,body_complete:true,content_decoding:{mode:'none',encoding:'identity'}},{request_id:'synthetic-pilot-example',request_started_at_utc:'2026-10-29T01:00:00Z',response_received_at_utc:'2026-10-29T01:00:01Z',collector_sha256:'a'.repeat(64)});
 return {classification:'synthetic_only',warning:'Illustrative FT/AET/PEN labels and simulated headers/clocks; no historical status or current quota claim.',plan:pilotPlan(),capture,analysis:analyzeCapture(capture,rows)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let retained=null;
 if(args.length){if(args.length!==2||args[0]!=='--retained-selection'||!isAbsolute(args[1]))throw Error('usage: example.mjs [--retained-selection /private/pilot-selection-evidence.json]');
  const evidence=parseBoundedJSON(readFileSync(args[1],'utf8')).value;retained=evidence.inventories[0].selected.map(x=>x.record);
 }
 const example=syntheticPilotExample(retained),{capture,...review}=example;
 // Private retained mode never prints row contents or raw body. All values remain simulated.
 process.stdout.write(JSON.stringify(retained?{classification:review.classification,warning:review.warning,manifest:capture.manifest,inventory:review.analysis.reconciliation.inventory,records:review.analysis.reconciliation.records,source_review_admissible:false}:{...review,capture:{manifest:capture.manifest,body_base64:capture.bytes.toString('base64')}},null,2)+'\n');
}
