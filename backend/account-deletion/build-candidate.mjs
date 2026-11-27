import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {applyPatch} from '../ai-generation/build-candidate.mjs';
export const normalizeCapture=s=>s.replaceAll('\r\n','\n').replace(/\n?$/,'\n');
export const V2_SHA256='71a613b216ce8bff8eaf93fcad2a2c077026c1e71b25513f5cb894df15c68295';
export async function buildCandidate(sourcePath,outPath){
 sourcePath=sourcePath instanceof URL?fileURLToPath(sourcePath):sourcePath;
 outPath=outPath instanceof URL?fileURLToPath(outPath):outPath;
 if(resolve(sourcePath)===resolve(outPath))throw Error('Do not overwrite the private baseline');
 const bytes=await readFile(sourcePath);if(createHash('sha256').update(bytes).digest('hex')!==V2_SHA256)throw Error('Captured delete-account v2 hash mismatch');
 const source=normalizeCapture(bytes.toString('utf8')),patch=(await readFile(new URL('delete-account-v2-checked-cleanup.patch',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const candidate=applyPatch(source,patch);await mkdir(dirname(outPath),{recursive:true});await writeFile(outPath,candidate);
 const modulePath=resolve(dirname(outPath),'backend/account-deletion/deletion-service.mjs');await mkdir(dirname(modulePath),{recursive:true});await copyFile(new URL('deletion-service.mjs',import.meta.url),modulePath);
 await copyFile(new URL('password-verification.mjs',import.meta.url),resolve(dirname(modulePath),'password-verification.mjs'));
 return{baseline_sha256:V2_SHA256,candidate_sha256:createHash('sha256').update(candidate).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(!process.argv[2]||!process.argv[3])throw Error('Pass exact private source and candidate output paths');console.log(JSON.stringify(await buildCandidate(resolve(process.argv[2]),resolve(process.argv[3]))));}
