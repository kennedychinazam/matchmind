// Field-aware implementation safety correction. Prompt/schema v0.2.0 unchanged.
// These negative checks supplement source capabilities and closed field schemas;
// labels/ref strings never establish real source authority or semantic truth.
import {isUtf8} from 'node:buffer';
export const TEXT_POLICY_VERSION='a4-text-policy-v0.2.2';
export const prohibited=/bookmaker|\bodds\b|implied|\blambda\b|engine|forecast|prediction|recommend|\bROI\b|\bEV\b|consensus|ignore.*(?:instructions|rules|previous)|disregard|assistant:|system:|developer:|system prompt|you are|tool.call|https?:|<script|base64|override|act as|\bbet\b/iu;
const controls=/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const encoded=/\\(?:u[0-9a-f]{4}|x[0-9a-f]{2})|%[0-9a-f]{2}|&#(?:x[0-9a-f]+|[0-9]+);|&(?:lt|gt|quot|amp);/iu;
const directive=/ignore\b.*\b(?:instructions|rules|previous)|disregard|(?:assistant|system|developer)\s*:|system\s+prompt|\byou are\b|tool[._ ]?call|<\s*\/?\s*(?:script|system|assistant)|\boverride\b|\bact as\b/iu;
const data=/\b(?:odds|(?:bookmaker\s+)?price|probabilit(?:y|ies)|confidence|implied|lambda(?:home|away|[ha])?|roi|ev)\s*(?:[:=]\s*)?[+-]?(?:[0-9]|\.[0-9])|\b(?:engine|model|AI)\s+(?:forecast|prediction|probabilit|output|recommend|rate)|\b(?:openai|gemini|gpt(?:[- ]?[0-9]+)?)\s+(?:says|predicts|forecasts|recommends)|\b(?:home|away|draw)[ _-]?(?:probabilit(?:y|ies)|odds)\b/iu;
const forbiddenNamespace=/(?:^|[:/._-])(?:bookmakers?|engine|forecasts?|predictions?|openai|openrouter|gemini|lambda|base64|b64|hex|urlencoded)(?=$|[:/._-])|(?:^|[:/._])odds(?:[-_](?:snapshots?|latest|prices?|markets?|quotes?|feeds?|data|home|away|draw)(?=$|[:/._-])|(?=$|[:/._]))/iu;
const phrasedData=/\b(?:odds|price|probabilit(?:y|ies)|confidence|lambda(?:home|away|[ha])?)\s+(?:are|is|were|was|of|at|for)\s*(?:[:=]\s*)?[+-]?(?:[0-9]|\.[0-9])|\b(?:forecast|prediction|probabilit(?:y|ies)|recommendation|output)\s+(?:from|by|of)\s+(?:engine|model|AI|openai|gemini|gpt)/iu;
// Decimal/fraction annotations are ambiguous price channels even without a
// betting keyword. Quarantine rather than guess an identity or strip a suffix.
// Integers/ordinals and full four-digit season labels remain representable.
// Short slash forms (including abbreviated seasons) require unavailable source
// disambiguation; a synthetic signature is not authority to exempt them.
function identityPrice(value){
 if(/[0-9]+[.,][0-9]+/u.test(value))return true;
 for(const match of value.matchAll(/([0-9]+)\s*\/\s*([0-9]+)/gu)){
  const[,left,right]=match;
  // Only an explicit four-digit starting year with the consecutive ending
  // year has season syntax. This is representation, not a verified season.
  const next=String(Number(left)+1);
  if(!/^[12][0-9]{3}$/u.test(left)||!(right===next||right===next.slice(-2)))return true;
 }
 return false;
}
function decodedCandidates(value){const found=[];for(const token of new Set([value,...value.split(/[:.\s]/u)])){if(token.length<8||token.length>256||/^[0-9a-f]{32,128}$/iu.test(token)||!(/^[A-Za-z0-9+/_-]+={0,2}$/u).test(token))continue;const normalized=token.replace(/=+$/u,'').replace(/\+/gu,'-').replace(/\//gu,'_');let bytes;try{bytes=Buffer.from(token,'base64url');}catch{continue;}if(bytes.length>=4&&isUtf8(bytes)&&bytes.toString('base64url')===normalized)found.push(bytes.toString('utf8'));}return found;}
function views(text){const out=[text];let current=[text];for(let depth=0;depth<2;depth++){const next=[];for(const value of current)for(const decoded of decodedCandidates(value))if(!out.includes(decoded)){out.push(decoded);next.push(decoded);}current=next;}if(current.some(value=>decodedCandidates(value).length))throw Error('unresolved_encoded_football_text');return out;}
function maskLabels(value,labels){let out=value;for(const label of [...new Set(labels.filter(x=>typeof x==='string'&&x.length))].sort((a,b)=>b.length-a.length)){const escaped=label.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');out=out.replace(new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','giu'),'[fixture identity]');}return out;}
export function validateFootballText(value,role='commentary',identityLabels=[]){
 if(!['identity_label','identifier','commentary'].includes(role))throw Error('unknown_football_text_role');if(typeof value!=='string')return;
 if(controls.test(value)||value.normalize('NFKC')!==value||encoded.test(value))throw Error('prohibited_or_ambiguous_football_text');
 const candidates=views(value);for(const candidate of candidates)if(controls.test(candidate)||encoded.test(candidate)||directive.test(candidate)||data.test(candidate)||phrasedData.test(candidate))throw Error('prohibited_football_instruction_or_data');
 if(role==='identity_label'){if(candidates.some(identityPrice))throw Error('identity_label_price_or_fraction');if(/[{}\[\]<>`=;|\\]/u.test(value))throw Error('identity_label_structure');return;}
 if(role==='identifier'){if(!/^[A-Za-z0-9][A-Za-z0-9_.:/@+-]*$/u.test(value)||/^[A-Za-z]+:\/\//u.test(value)||candidates.some(s=>forbiddenNamespace.test(s)))throw Error('prohibited_or_ambiguous_source_reference');return;}
 // Names already bound to the validated fixture may be cited as names, not used
 // as an exemption for adjacent instructions, prices or forecast information.
 for(const candidate of candidates)if(prohibited.test(maskLabels(candidate,identityLabels)))throw Error('prohibited_football_commentary');
}
