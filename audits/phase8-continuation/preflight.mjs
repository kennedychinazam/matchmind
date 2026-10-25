import {MODELS,absenceProviders,freezeProfile,verifyAccount} from './contracts.mjs';
export async function providerPreflight(client,clock=()=>new Date().toISOString(),operatorEvidence,models=MODELS){
 absenceProviders(models); // Reject unknown models before any metadata request.
 // Read-only metadata only. A restricted-key 403 on credits is a blocker, never a reason to use a management key.
 const [key,credits,...catalogs]=await Promise.all([client.get('key'),client.get('credits'),...models.map(m=>client.get('models/'+m+'/endpoints'))]);
 const now=clock();return{account:verifyAccount(key,credits,now,operatorEvidence,models),profiles:catalogs.map(c=>freezeProfile(c,now)),observed_at_utc:now,paid_inference_executed:false};
}
