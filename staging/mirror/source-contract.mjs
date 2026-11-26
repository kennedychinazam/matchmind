export const SOURCE='https://toqfdrcjzwnlydqekude.supabase.co';
export const SOURCE_KEY='sb_publishable_wrXk5NFfWkrCdLgiQsaMHg_7lRPeO4-';
export function project(value,schema){
 if(value===null)return null;
 if(schema.type==='array')return value.map(x=>project(x,schema.items));
 if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).filter(([k])=>Object.hasOwn(value,k)).map(([k,s])=>[k,project(value[k],s)]));
 if(schema.type==='map')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,project(v,schema.values)]));
 return value;
}
export function windowFor(now){const d=new Date(now);const day=d.toISOString().slice(0,10);return{from:new Date(Date.parse(day)-6*86400000).toISOString().slice(0,10),to:new Date(Date.parse(day)+7*86400000).toISOString().slice(0,10),day};}
export const previousIssueEnabled=(env=process.env)=>env.MM_MIRROR_PREVIOUS_ISSUE==='1';
