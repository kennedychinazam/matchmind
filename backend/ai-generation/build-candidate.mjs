// Applies the reviewed patch only to the exact private captured v17 source.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const V17_SHA256='f6fba8320f767a0c9eabb1cd7430d2484c70cb26ae06f746d72b1eee5ac8545b';
export function applyPatch(source,patch){
 const lines=source.split('\n'),out=[];let position=0;
 const chunks=patch.split(/^@@ .* @@.*\n/m).slice(1),headers=[...patch.matchAll(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@.*$/gm)];
 if(!headers.length||headers.length!==chunks.length)throw Error('Invalid candidate patch');
 for(let i=0;i<headers.length;i++){
  const from=Number(headers[i][1])-1;out.push(...lines.slice(position,from));position=from;
  const edits=chunks[i].split('\n');if(edits.at(-1)==='')edits.pop();
  let old=0,added=0;
  for(const edit of edits){const kind=edit[0],text=edit.slice(1);if(kind==='-'||kind===' '){if(lines[position++]!==text)throw Error('Private source differs from patch');old++;}if(kind==='+'||kind===' '){out.push(text);added++;}if(!['+','-',' '].includes(kind))throw Error('Invalid patch line');}
  if(old!==Number(headers[i][2])||added!==Number(headers[i][4]))throw Error('Invalid patch counts');
 }
 return[...out,...lines.slice(position)].join('\n');
}
export async function buildCandidate(sourcePath,outPath){
 if(resolve(sourcePath)===resolve(outPath))throw Error('The private baseline must not be overwritten');
 const source=await readFile(sourcePath,'utf8');if(createHash('sha256').update(source).digest('hex')!==V17_SHA256)throw Error('Captured v17 source hash mismatch');
 const patch=await readFile(new URL('ai-analyze-v17-security.patch',import.meta.url),'utf8');const candidate=applyPatch(source,patch);
 await mkdir(dirname(outPath),{recursive:true});await writeFile(outPath,candidate);
 for(const name of ['generation-contract.mjs','generation-service.mjs','provider-fetch.mjs']){
  const target=resolve(dirname(outPath),'backend/ai-generation',name);await mkdir(dirname(target),{recursive:true});await copyFile(new URL(name,import.meta.url),target);
 }
 const guard=resolve(dirname(outPath),'backend/fixture-delivery/fixture-cache-guard.mjs');await mkdir(dirname(guard),{recursive:true});await copyFile(new URL('../fixture-delivery/fixture-cache-guard.mjs',import.meta.url),guard);
 return{baseline_sha256:V17_SHA256,candidate_sha256:createHash('sha256').update(candidate).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(!process.argv[2]||!process.argv[3])throw Error('Pass exact private source and private output paths');console.log(JSON.stringify(await buildCandidate(resolve(process.argv[2]),resolve(process.argv[3]))));}
