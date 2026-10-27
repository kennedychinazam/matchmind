// Legacy request messages contain the complete serialized competition table.
// Separate limits: never relax A4's 8K per-string bound or truncate this table.
export function cloneReplay(input){
 let nodes=0,bytes=0;const ancestors=new Set(),forbidden=new Set(['__proto__','prototype','constructor']);
 function copy(v,depth){
  if(depth>16||++nodes>100000)throw Error('replay_structure_bound');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('replay_number');return v;}
  if(typeof v==='string'){const n=Buffer.byteLength(v);bytes+=n;if(n>2*1024*1024||bytes>16*1024*1024)throw Error('replay_text_bound_no_truncation');return v;}
  if(!v||typeof v!=='object'||ancestors.has(v))throw Error('replay_json_value');
  const array=Array.isArray(v),keys=Reflect.ownKeys(v),descriptors=Object.getOwnPropertyDescriptors(v);
  if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype)||keys.some(k=>typeof k!=='string'||forbidden.has(k)))throw Error('replay_json_shape');
  if(array?(v.length>10000||keys.length!==v.length+1||Object.keys(v).some((k,i)=>k!==String(i))):keys.length>128)throw Error('replay_container_bound');
  for(const[k,d]of Object.entries(descriptors))if('get'in d||'set'in d||!d.enumerable&&!(array&&k==='length'))throw Error('replay_accessor');
  ancestors.add(v);const out=array?[]:{};for(const k of Object.keys(v)){bytes+=k.length;if(bytes>16*1024*1024)throw Error('replay_byte_bound');out[k]=copy(descriptors[k].value,depth+1);}ancestors.delete(v);return out;
 }
 return copy(input,0);
}
