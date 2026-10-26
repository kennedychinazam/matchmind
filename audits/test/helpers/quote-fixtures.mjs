import {readFileSync} from 'node:fs';
const schema=JSON.parse(readFileSync(new URL('../../quotes/quote.schema.json',import.meta.url)));
function blank(s){if('const'in s)return s.const;if(s.enum)return s.enum.includes(null)?null:s.enum[0];const t=s.type;if(Array.isArray(t)&&t.includes('null'))return null;if(t==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,blank(v)]));if(t==='array')return [];if(t==='string')return 'synthetic';if(t==='number')return 0;return null;}
export function quote(){const q=blank(schema);q.observation_id='synthetic:q1';q.stream_id='synthetic:stream';q.fixture={...q.fixture,matchmind_fixture_id:'100',provider_fixture_id:'p100',competition_id:'39',home_team_id:'h',away_team_id:'a',home_name:'Home',away_name:'Away',kickoff_utc:'2026-10-25T16:00:00Z',identity_mapping_ref:'synthetic:fixture-map',fixture_context_version:'v1'};
 q.bookmaker={...q.bookmaker,display_name:'Synthetic Book'};
 q.market={...q.market,canonical_code:'HOME',family:'match_result',selection:'home',line_half_units:null,period:'unknown',payoff_kind:'unknown',context:'unknown'};
 q.price={...q.price,decimal_text:'1.90',representation_origin:'unknown'};
 q.source={...q.source,source_response_ref:'synthetic:response',record_origin:'upstream_received_response',inventory_status:'unknown',source_sequence:'1'};
 q.state={suspension:'unknown',availability:'unknown',status_evidence_ref:null,observation_purpose:'upstream_observation'};
 q.settlement={...q.settlement,rules_status:'unknown',scope:'unknown'};q.accessibility={...q.accessibility,status:'unknown'};
 q.revision={...q.revision,revision_id:'synthetic:r1',change_kind:'initial_observation'};q.legacy=null;return q;}
export function snapshot(){return '{"id":17,"fxid":100,"captured_at":"2026-10-25T12:00:00+00:00","prices":{"Synthetic Book":{"h":1.90,"d":3.25,"a":4.00,"dc1x":1.20,"dc12":1.30,"dcx2":1.70,"bttsy":1.80,"bttsn":1.95,"o15":1.25,"u15":3.50,"o25":1.75,"u25":2.10,"o35":2.80,"u35":1.40}}}';}
export const fixtureContext={fxid:100,home:'Home',away:'Away',lid:39,date:'2026-10-25',time:'16:00'};
