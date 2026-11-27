import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {applyPatch} from '../ai-generation/build-candidate.mjs';
export const SOURCE_SHA256='2625107daf82e72c535d0968e152e76bb9ec89f3904e748d0bdd5940bd7bb9d1';
export async function buildCandidate(input,output){
 input=input instanceof URL?fileURLToPath(input):input;output=output instanceof URL?fileURLToPath(output):output;
 if(resolve(input)===resolve(output))throw Error('Do not overwrite the private baseline');
 const raw=await readFile(input);if(createHash('sha256').update(raw).digest('hex')!==SOURCE_SHA256)throw Error('Captured send-push v9 hash mismatch');
 const patch=(await readFile(new URL('send-push-v9-lifecycle.patch',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const candidate=applyPatch(raw.toString('utf8').replaceAll('\r\n','\n'),patch);await mkdir(dirname(output),{recursive:true});await writeFile(output,candidate);
 const target=resolve(dirname(output),'backend/push-lifecycle/sender-guard.mjs');await mkdir(dirname(target),{recursive:true});await copyFile(new URL('sender-guard.mjs',import.meta.url),target);
 return{baseline_sha256:SOURCE_SHA256,candidate_sha256:createHash('sha256').update(candidate).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildCandidate(process.argv[2],process.argv[3])));
