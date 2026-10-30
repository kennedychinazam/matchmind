import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
export const VERSION='0.2.0';
const paths=['prompts/0.2.0.md','baselines/prompt-0.1.0.md','baselines/response-0.1.0.schema.json','response.schema.json','source.schema.json','packet.schema.json','definitions.json'];
const manifest=JSON.parse(readFileSync(new URL('./artifact-manifest.json',import.meta.url),'utf8'));
if(manifest.version!==VERSION||Object.keys(manifest.artifacts).length!==paths.length)throw Error('artifact_version_manifest');
for(const path of paths){const expected=manifest.artifacts[path],actual=createHash('sha256').update(readFileSync(new URL('./'+path,import.meta.url))).digest('hex');if(!/^[0-9a-f]{64}$/.test(expected)||expected!==actual)throw Error('artifact_hash_mismatch:'+path);}
export const ARTIFACTS=Object.freeze({...manifest.artifacts});
