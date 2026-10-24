import {mkdirSync,chmodSync,writeFileSync,readFileSync,realpathSync}from 'node:fs';
import {resolve,relative,isAbsolute}from 'node:path';
import {fileURLToPath}from 'node:url';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {trainingRepository,syntheticClockProof}from './local.mjs';
import {estimatePilot}from './pilot.mjs';
import {assessAvailability}from './availability.mjs';
const directory=process.argv[2];if(!directory||!isAbsolute(directory)||process.argv.length!==3)throw Error('usage: node audits/phase7/run-synthetic.mjs /private/absolute/directory');
for(const k of Object.keys(process.env))if(/((OPENAI|ANTHROPIC|GEMINI|MISTRAL|GROQ|DEEPSEEK|COHERE|OPENROUTER).*(KEY|TOKEN)|^(HF_TOKEN|GOOGLE_API_KEY|API_FOOTBALL_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY)$)/i.test(k)&&process.env[k])throw Error('provider/hosted credential present; use a clean offline environment');
mkdirSync(directory,{recursive:true,mode:0o700});const real=realpathSync(directory),root=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
if(!relative(root,real).startsWith('..'))throw Error('private exports must remain outside public Git');chmodSync(real,0o700);
const save=(name,value)=>writeFileSync(resolve(real,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
docker(['image','inspect',IMAGE]);const db=localDatabase('phase7-proof');await db.start();
try{
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();trainingRepository(db).install();
 const proof=await syntheticClockProof(db,{privateSink:({privateKey,...data})=>{for(const[k,v]of Object.entries(data))save(k+'.json',v);writeFileSync(resolve(real,'synthetic-signing-key.pem'),privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});}});
 writeFileSync(resolve(real,'private-training-backup.sql'),db.dump(),{mode:0o600});
 const result={assessment:assessAvailability(),proof,pilots:[7,14,28].flatMap(days=>[52080,68400,99000].map(bootstrapObservations=>estimatePilot({days,bootstrapObservations}))),accuracy_claim:false,production_ready:false};
 save('aggregates.json',result);process.stdout.write(JSON.stringify(result,null,2)+'\n');
}finally{db.close();}
