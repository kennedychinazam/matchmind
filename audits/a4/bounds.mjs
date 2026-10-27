// A4 isolated fork, larger complete-history bounds; accepted quote parser unchanged. No getters, prototypes, duplicate keys or I/O.
import {createHash} from 'node:crypto';
export const LIMITS=Object.freeze({rawBytes:16777216,quoteBytes:32768,depth:12,nodes:500000,arrayItems:65536,objectKeys:128,stringChars:8192,identifierChars:128,referenceChars:256,books:64,marketsPerBook:64,history:1024});
const forbidden=new Set(['__proto__','prototype','constructor']);
export function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
export function parseBoundedJSON(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>LIMITS.rawBytes)throw Error('json_size_or_type');
 let at=0,nodes=0;const tokens=new Map();
 const ws=()=>{while(/[\x20\t\r\n]/.test(raw[at]??'!'))at++;};
 function string(){const start=at++;while(at<raw.length){const c=raw[at++];if(c==='"'){const v=JSON.parse(raw.slice(start,at));if(v.length>LIMITS.stringChars)throw Error('json_string_limit');return v;}if(c==='\\')at++;}throw Error('json_string');}
 function value(depth,path){if(depth>LIMITS.depth||++nodes>LIMITS.nodes)throw Error('json_structure_limit');ws();const start=at,c=raw[at];let out;
  if(c==='"')out=string();
  else if(c==='{'||c==='['){const object=c==='{';out=object?{}:[];at++;ws();if(raw[at]===(object?'}':']')){at++;return out;}let count=0;
   while(true){if(++count>(object?LIMITS.objectKeys:LIMITS.arrayItems))throw Error('json_container_limit');ws();let key=String(count-1);if(object){if(raw[at]!=='"')throw Error('json_key');key=string();if(forbidden.has(key)||Object.hasOwn(out,key))throw Error('json_duplicate_or_prototype_key');ws();if(raw[at++]!==':')throw Error('json_colon');}const v=value(depth+1,[...path,key]);if(object)out[key]=v;else out.push(v);ws();const end=raw[at++];if(end===(object?'}':']'))break;if(end!==',')throw Error('json_separator');}
  }else{const rest=raw.slice(at);const m=rest.match(/^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!m)throw Error('json_value');at+=m[0].length;out=JSON.parse(m[0]);if(typeof out==='number'&&!Number.isFinite(out))throw Error('json_number_nonfinite');}
  tokens.set(JSON.stringify(path),raw.slice(start,at));return out;
 }
 const result=value(0,[]);ws();if(at!==raw.length)throw Error('json_trailing_input');return {value:result,tokens};
}
export function safeClone(input){let nodes=0;const ancestors=new Set();
 function clone(v,depth){if(depth>LIMITS.depth||++nodes>LIMITS.nodes)throw Error('json_structure_limit');if(v===null||typeof v==='boolean')return v;if(typeof v==='string'){if(v.length>LIMITS.stringChars)throw Error('json_string_limit');return v;}if(typeof v==='number'&&Number.isFinite(v))return v;if(!v||typeof v!=='object'||ancestors.has(v))throw Error('json_value_or_cycle');const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))throw Error('json_prototype');const keys=Reflect.ownKeys(v);if(keys.some(k=>typeof k!=='string'))throw Error('json_symbol');const descriptors=Object.getOwnPropertyDescriptors(v);for(const [k,d]of Object.entries(descriptors))if(('get'in d)||('set'in d)||forbidden.has(k)||(!d.enumerable&&!(array&&k==='length')))throw Error('json_accessor_or_prototype_key');
  if(array&&(v.length>LIMITS.arrayItems||keys.length!==v.length+1||Object.keys(v).some((k,i)=>String(i)!==k)))throw Error('json_array');if(!array&&keys.length>LIMITS.objectKeys)throw Error('json_container_limit');ancestors.add(v);const out=array?[]:{};for(const k of Object.keys(v))out[k]=clone(descriptors[k].value,depth+1);ancestors.delete(v);return out;
 }
 const out=clone(input,0);if(Buffer.byteLength(JSON.stringify(out))>LIMITS.rawBytes)throw Error('json_size');return out;
}
export function canonicalJSON(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';}
export function hash(value){return createHash('sha256').update(canonicalJSON(safeClone(value))).digest('hex');}
export function rawHash(raw){return createHash('sha256').update(raw).digest('hex');}
export function text(value,max=LIMITS.referenceChars){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('invalid_text');return value;}
