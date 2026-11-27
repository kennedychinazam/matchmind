import{readFile,writeFile,mkdir,copyFile}from'node:fs/promises';
import{createHash}from'node:crypto';import{resolve,dirname}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';
export const AF47_SHA256='9d786e830b52fbbd52c71289524f5adacac38a683379a6ca3d8b7471f9237195';
export function candidateSource(bytes){
 if(createHash('sha256').update(bytes).digest('hex')!==AF47_SHA256)throw Error('Exact deployed af-47 Git blob required');
 let code=bytes.toString('utf8');
 const edits=[['https://esm.sh/@supabase/supabase-js@2"','https://esm.sh/@supabase/supabase-js@2.119.2"'],['const Ue="af-47"','const Ue="af-48"'],['await fetch($t+a,','await collectorFetch($t+a,'],['const S=qt(P,H);','const S=qt(P,H,{global:{fetch:collectorFetch}});']];
 for(const[from,to]of edits){if(code.split(from).length!==2)throw Error('Collector integration token drift');code=code.replace(from,to);}
 return 'import {collectorFetch} from "./backend/collector-observability/request-deadline.mjs";\n'+code;
}
export async function buildCandidate(input,output){
 input=input instanceof URL?fileURLToPath(input):input;output=output instanceof URL?fileURLToPath(output):output;
 if(resolve(input)===resolve(output))throw Error('Do not overwrite the baseline');
 const code=candidateSource(await readFile(input));await mkdir(dirname(output),{recursive:true});await writeFile(output,code);
 const target=resolve(dirname(output),'backend/collector-observability/request-deadline.mjs');await mkdir(dirname(target),{recursive:true});await copyFile(new URL('request-deadline.mjs',import.meta.url),target);
 return{baseline_sha256:AF47_SHA256,candidate_sha256:createHash('sha256').update(code).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildCandidate(process.argv[2],process.argv[3])));
