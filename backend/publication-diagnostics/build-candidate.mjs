// Exact private captures are provided separately; no private source is embedded here.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const profiles={
 production:{schema_valid:'a71ea2ef1995e9ae582939d9d18f9d5f07c69a36097ac15e53e818a2410f3bf0',payload_valid:'cea48e3650c733d376ec614647014d7275d7e82678d86ae81ab17bf52ddc4b4c',materialize:'fa9281e283bce95c5ad911576ebedaf884da8f284881ab3e2334380bd81c7ffd'},
 staging:{schema_valid:'933c26fbcb6c2e3d906c93c48e310ddd58527445d231036eca14de74fc4b109a',payload_valid:'31028fb378d5d2428992a75eda6776d3f4bda1176d9e4e91826cf77b426e67dc',materialize:'cf6d776b44baa938c3ec847c5d35c8f4fe8e1e6cdf74f6a19a20d9e8f22c5c61'}
};
const sha=s=>createHash('sha256').update(s).digest('hex');
const branches=[['CARDS_DUPLICATE','$.cards'],['PREDICTION_PROBABILITY_VECTOR','$.cards[*].prediction'],['BOARD_COUNT','$.board.n'],['BOARD_DUPLICATE','$.board.rows'],['BOARD_REFERENCE','$.board.rows[*].f'],['BOARD_IDENTITY','$.board.rows[*]'],['BOARD_PROBABILITY_VECTOR','$.board.rows[*]'],['TIPS_TAB_OR_RANK','$.slips[*].legs'],['TIPS_RANK_DUPLICATE','$.slips[*].legs'],['TIPS_TAB_BOUND','$.slips[*].legs'],['SLIP_LEG_BOUND','$.slips[*].legs'],['SLIP_REFERENCE','$.slips[*].legs[*].fxid'],['ENGINE_RECORD_KEY','$.records.engine.key'],['CLV_RECORD_KEY','$.records.clv.key']];
export async function buildCandidate(profile,directory,output){
 const expected=Object.hasOwn(profiles,profile)?profiles[profile]:null;if(!expected)throw Error('Choose exact production or staging profile');
 if(Object.keys(profiles).some(p=>Object.keys(profiles[p]).some(n=>resolve(directory,`${p}-${n}.sql`)===resolve(output))))throw Error('Do not overwrite a private capture');
 const source={};for(const name of Object.keys(expected)){const p=resolve(directory,`${profile}-${name}.sql`);if(p===resolve(output))throw Error('Do not overwrite a private capture');const raw=await readFile(p);if(sha(raw)!==expected[name])throw Error(`Captured ${profile} ${name} hash mismatch`);source[name]=raw.toString('utf8');}
 const original=source.payload_valid,match=original.match(/if octet_length\(v::text\)>(\d+) or not mm_fixture_delivery.schema_valid\(v,(\$schema\$.*?\$schema\$::jsonb)\) then return false;end if;/s);
 if(!match)throw Error('Exact first validation branch missing');
 let body=original.slice(original.indexOf('AS $function$')+14,original.lastIndexOf('$function$')).trim();
 body=body.replace('declare c jsonb;', 'declare detail jsonb;c jsonb;');
 body=body.replace(match[0],()=>`if octet_length(v::text)>${match[1]} then return jsonb_build_object('code','PAYLOAD_BYTES','path','$');end if;\n detail=mm_publication_diagnostics.schema_failure(v,${match[2]});if detail is not null then return detail;end if;`);
 let rules=[...branches];if(profile==='staging')rules.splice(1,0,['ANALYSIS_PROBABILITY_VECTOR','$.cards[*].analysis.result']);if(profile==='staging')rules.push(['COMPETITION_RELATION','$.competitions']);
 body=body.replace('exception when others then return false;',()=>"exception when others then return jsonb_build_object('code','RELATION_EXCEPTION','path','$');");
 let index=0;
 body=body.replaceAll('return false;',()=>{if(index>=rules.length)throw Error('Unexpected validator rejection branch');const [code,path]=rules[index++];return `return jsonb_build_object('code','${code}','path','${path}');`;});
 // Every known relational rejection is accounted for; the catch-all has a fixed code.
 if(index!==rules.length)throw Error(`Validator branch count changed ${index}`);
 body=body.replaceAll('return true;','return null;');
 let materialize=source.materialize;
 const rejection=/if not mm_fixture_delivery\.payload_valid\(built\) then raise exception 'Incomplete or unsupported presentation inventory(?: \(% cards, % bytes\))?'(?:,nc,nb)?;end if;/;
 if(!rejection.test(materialize))throw Error('Materializer rejection branch missing');
 materialize=materialize.replace(rejection,"if not mm_fixture_delivery.payload_valid(built) then raise exception 'Presentation validation failed' using errcode='MMV01',detail=mm_publication_diagnostics.inspect(built)::text;end if;");
 if(profile==='production')materialize=materialize.replace('exceeds the 1500-card bound','exceeds the 3000-card bound').replace('exceeds the 2 MiB bound','exceeds the 4 MiB bound');
 const guard=Object.entries(expected).map(([name,hash])=>`if encode(sha256(convert_to(pg_get_functiondef('mm_fixture_delivery.${name}(${name==='schema_valid'?'jsonb,jsonb,integer':name==='payload_valid'?'jsonb':''})'::regprocedure),'UTF8')),'hex')<>'${hash}' then raise exception 'Publication source drift: ${name}';end if;`).join('\n');
 const walker=await readFile(new URL('schema-failure.sql',import.meta.url),'utf8');
 const sql=`-- UNEXECUTED ${profile}-specific local proposal; matched source and role review required.\nbegin;\ndo $$begin\n${guard}\nend$$;\ncreate schema mm_publication_diagnostics;\nrevoke all on schema mm_publication_diagnostics from public,anon,authenticated;\n${walker}\ncreate function mm_publication_diagnostics.relation_failure(v jsonb) returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $function$\n${body}\n$function$;\ncreate function mm_publication_diagnostics.inspect(v jsonb) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$\ndeclare accepted boolean;reason jsonb;validator_hash text;schema_hash text;begin\n validator_hash=encode(sha256(convert_to(pg_get_functiondef('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure),'UTF8')),'hex');schema_hash=encode(sha256(convert_to(pg_get_functiondef('mm_fixture_delivery.schema_valid(jsonb,jsonb,integer)'::regprocedure),'UTF8')),'hex');\n accepted=coalesce(mm_fixture_delivery.payload_valid(v),false);\n if validator_hash<>'${expected.payload_valid}' or schema_hash<>'${expected.schema_valid}' then reason=jsonb_build_object('code','VALIDATOR_SOURCE_DRIFT','path','$');elsif accepted then reason=jsonb_build_object('code','VALID','path','$');else reason=coalesce(mm_publication_diagnostics.relation_failure(v),jsonb_build_object('code','VALIDATOR_REJECTED','path','$'));end if;\n return jsonb_build_object('protocol','matchmind-publication-diagnostic/1','profile','${profile}','validator_sha256',validator_hash,'accepted',accepted,'code',reason->>'code','path',left(reason->>'path',240),'payload_sha256',encode(sha256(convert_to(coalesce(v::text,'null'),'UTF8')),'hex'),'bytes',octet_length(v::text),'cards',case when jsonb_typeof(v->'cards')='array' then jsonb_array_length(v->'cards') else null end);\n end$$;\nrevoke all on all functions in schema mm_publication_diagnostics from public,anon,authenticated;\ngrant usage on schema mm_publication_diagnostics to service_role,mm_display_materializer;\ngrant execute on all functions in schema mm_publication_diagnostics to service_role,mm_display_materializer;\n${materialize};\ncommit;\n`;
 await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,sql);
 return{profile,source_sha256:expected,candidate_sha256:sha(sql),rules:rules.map(([code,path])=>({code,path})),original_validators_changed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildCandidate(process.argv[2],process.argv[3],process.argv[4])));
