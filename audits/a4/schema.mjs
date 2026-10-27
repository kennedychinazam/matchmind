import './artifacts.mjs';
import {readFileSync} from 'node:fs';
import {safeClone,parseBoundedJSON,freeze} from './bounds.mjs';
import {instant} from '../quotes/contract.mjs';
export const DICTIONARY=freeze(JSON.parse(readFileSync(new URL('./definitions.json',import.meta.url))));
export const SOURCE_SCHEMA=freeze(JSON.parse(readFileSync(new URL('./source.schema.json',import.meta.url))));
export const PACKET_SCHEMA=freeze(JSON.parse(readFileSync(new URL('./packet.schema.json',import.meta.url))));
export const RESPONSE_SCHEMA=freeze(JSON.parse(readFileSync(new URL('./response.schema.json',import.meta.url))));
const supported=new Set(['$schema','$id','title','type','additionalProperties','required','properties','enum','const','pattern','format','minimum','maximum','minLength','maxLength','maxItems','minItems','items']);
function check(s){for(const k of Object.keys(s))if(!supported.has(k))throw Error('unsupported_schema_keyword:'+k);for(const x of Object.values(s.properties??{}))check(x);if(s.items)check(s.items);}check(SOURCE_SCHEMA);check(RESPONSE_SCHEMA);check(PACKET_SCHEMA);
export function validate(input,schema){const x=typeof input==='string'?parseBoundedJSON(input).value:safeClone(input);
 function visit(v,s,p){const type=v===null?'null':Array.isArray(v)?'array':typeof v,types=Array.isArray(s.type)?s.type:[s.type];if('const'in s&&v!==s.const||s.enum&&!s.enum.includes(v))throw Error('schema_value:'+p);if(s.type&&!types.includes(type)&&!(type==='number'&&Number.isSafeInteger(v)&&types.includes('integer')))throw Error('schema_type:'+p);if(v===null)return;if(type==='string'){if(v.length<(s.minLength??0)||v.length>(s.maxLength??Infinity)||s.pattern&&!new RegExp(s.pattern).test(v))throw Error('schema_text:'+p);if(s.format==='date-time')instant(v);}if(type==='number'&&(v<(s.minimum??-Infinity)||v>(s.maximum??Infinity)))throw Error('schema_number:'+p);if(type==='object'){for(const k of s.required??[])if(!Object.hasOwn(v,k))throw Error('schema_required:'+p+'.'+k);for(const[k,z]of Object.entries(v)){if(!Object.hasOwn(s.properties??{},k))throw Error('schema_extra:'+p+'.'+k);visit(z,s.properties[k],p+'.'+k);}}if(type==='array'){if(v.length<(s.minItems??0)||v.length>(s.maxItems??Infinity))throw Error('schema_array:'+p);for(const z of v)visit(z,s.items,p+'[]');}}
 visit(x,schema,'root');return x;
}
export {prohibited} from './text-policy.mjs';
export {validateFootballText as footballText} from './text-policy.mjs';
