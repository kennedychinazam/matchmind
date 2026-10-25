// Metadata-only preflight. Never issues a paid completion, even when all checks pass.
import {readFileSync,writeFileSync} from 'node:fs';import {join,isAbsolute} from 'node:path';
import {privateDirectory} from '../phase8/files.mjs';import {openrouterClient} from './transport.mjs';import {providerPreflight} from './preflight.mjs';
const [runtimeFile,outDir,evidenceFile]=process.argv.slice(2);
if(![4,5].includes(process.argv.length)||![runtimeFile,outDir].every(x=>x&&isAbsolute(x))||evidenceFile&&!isAbsolute(evidenceFile))throw Error('usage: preflight-cli.mjs /private/current-runtime-proof.json /private/new-preflight-directory [/private/operator-evidence.json]');
const dir=privateDirectory(outDir);let result;
try{
 const runtime=JSON.parse(readFileSync(runtimeFile,'utf8')),client=openrouterClient(runtime);
 result={ready:true,...await providerPreflight(client,undefined,evidenceFile?JSON.parse(readFileSync(evidenceFile,'utf8')):undefined),paid_inference_executed:false};
}catch(error){result={ready:false,paid_inference_executed:false,blocked_gate:error.status_code?'http_'+error.status_code+'_'+error.route_kind:/runtime/.test(error.message)?'runtime':/balance/.test(error.message)?'account_balance':/key/.test(error.message)?'key_restrictions':'metadata_contract',reason:'runtime_secret_network_account_balance_or_endpoint_gate_failed; inspect individually without exposing credentials'};process.exitCode=2;}
writeFileSync(join(dir,'preflight.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
process.stdout.write(JSON.stringify({ready:result.ready,paid_inference_executed:false})+'\n');
