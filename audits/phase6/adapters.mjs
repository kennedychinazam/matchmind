// Trusted offline registry. No uploaded code, provider clients or training here.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourceHash=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
export const ADAPTERS=Object.freeze({
 'identity-v1':Object.freeze({sha256:sourceHash,required_features:[],validate(c){
  if(Object.keys(c).length)throw Error('identity configuration must be empty');
 },execute({baseline}){return [...baseline];}}),
 'm14-xgedge-v1':Object.freeze({sha256:sourceHash,required_features:['xgEdge'],validate(c){
  if(Object.keys(c).sort().join(',')!=='artifact_kind,beta'||c.artifact_kind!=='synthetic'||typeof c.beta!=='number'||!Number.isFinite(c.beta)||Math.abs(c.beta)>1)throw Error('unsupported coefficient artifact');
 },execute({baseline,features,configuration}){
  const [h,d,a]=baseline;
  if(configuration.beta===0)return [...baseline];
  // A one-coefficient conditional win-share hypothesis, not an M14 ridge mapping.
  // Preserve original home+away mass and draw. Only synthetic artifacts may execute.
  if(h<=0||a<=0)throw Error('conditional odds undefined');
  const z=Math.log(h/a)+configuration.beta*features.xgEdge;
  const share=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
  return [(h+a)*share,d,(h+a)*(1-share)];
 }})
});
