// Reproducible simulated HTTP only. No actual provider fixture or request.
import {captureResponse,reconcile,correctionSidecar,TRANSFORMATION} from './offline.mjs';
const fixture={fixture:{id:1,date:'2026-10-25T18:00:00Z',status:{short:'AET',long:'Match Finished After Extra Time',elapsed:120}},league:{id:135,name:'Synthetic League',country:'Italy',season:2026},teams:{home:{id:1,name:'Synthetic Home FC'},away:{id:2,name:'Synthetic Away FC'}},goals:{home:3,away:1},score:{halftime:{home:1,away:0},fulltime:{home:2,away:1},extratime:{home:1,away:0},penalty:{home:null,away:null}}};
const metadata={capture_id:'synthetic-example-001',provider:'api-football-v3',base_url:'https://v3.football.api-sports.io',endpoint:'/fixtures',query:{ids:'1'},requested_ids:[1],request_started_at_utc:'2026-10-28T01:00:00Z',response_received_at_utc:'2026-10-28T01:00:01Z',provider_date_utc:null,http_status:200,content_type:'application/json',collector_commit:'0'.repeat(64),transformation_version:TRANSFORMATION};
const simulatedBody=()=>Buffer.from(JSON.stringify({get:'fixtures',parameters:{ids:'1'},errors:[],results:1,paging:{current:1,total:1},response:[fixture]},null,2)+'\n');
const original=captureResponse({bytes:simulatedBody(),metadata});
const normalized=[{fxid:1,lid:135,home:fixture.teams.home.name,away:fixture.teams.away.name,status:'FINISHED',gh:3,ga:1,ft_h:2,ft_a:1,ht_h:1,ht_a:0}];
const defaultReview=reconcile({captures:[original],normalized});
const syntheticRuleReview=reconcile({captures:[original],normalized,synthetic_period_rule:'synthetic-fulltime-v1'});
fixture.goals.home=4;const newer=captureResponse({bytes:simulatedBody(),metadata:{...metadata,capture_id:'synthetic-example-002',request_started_at_utc:'2026-10-28T01:01:00Z',response_received_at_utc:'2026-10-28T01:01:01Z'}});
console.log(JSON.stringify({classification:'ENTIRELY_SYNTHETIC_NOT_PROVIDER_EVIDENCE',capture:{manifest:original.manifest,simulated_http_bytes_base64:original.bytes.toString('base64')},normalized,defaultReview,syntheticRuleReview,correction:correctionSidecar({prior:original,next:newer,fixture_id:1,reason:'provider_revision_observed'})},null,2));
