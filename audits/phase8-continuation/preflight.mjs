import {MODELS,freezeProfile,verifyAccount} from './contracts.mjs';
export async function providerPreflight(client,clock=()=>new Date().toISOString(),operatorEvidence){
 // Read-only metadata only. A restricted-key 403 on credits is a blocker, never a reason to use a management key.
 const [key,credits,...catalogs]=await Promise.all([client.get('key'),client.get('credits'),...MODELS.map(m=>client.get('models/'+m+'/endpoints'))]);
 const now=clock();return{account:verifyAccount(key,credits,now,operatorEvidence),profiles:catalogs.map(c=>freezeProfile(c,now)),observed_at_utc:now,paid_inference_executed:false};
}
