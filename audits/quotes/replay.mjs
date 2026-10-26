// Offline classification/replay only. No trusted source-verifier implementation
// or actionable gate exists in Stage 2A/2B. All supplied evidence refs are claims.
import {validateQuote,quoteHash,instant,decimal} from './contract.mjs';
import {safeClone,freeze,hash,LIMITS,text} from './bounded-json.mjs';
function policy(options){const p=safeClone(options);for(const k of Object.keys(p))if(!['decisionAt','maxSeenAgeMs'].includes(k))throw Error('unsupported_admission_option');if(p.decisionAt!==undefined)instant(p.decisionAt);if(p.maxSeenAgeMs!==undefined&&(!Number.isSafeInteger(p.maxSeenAgeMs)||p.maxSeenAgeMs<=0||p.maxSeenAgeMs>86400000))throw Error('invalid_research_age_bound');return p;}
export function classifyQuote(input,options={}){
 const p=policy(options);let q;try{q=validateQuote(input);}catch(e){return freeze({category:'rejected',origin_class:'unparsed_observation',actionable:false,verification:'unverified_claims',reasons:['invalid_contract',e.message]});}
 const reasons=['source_verifier_unavailable','actionable_admission_disabled'],t=q.times,m=q.market;
 const missing=(values,reason)=>{if(values.some(v=>v===null||v==='unknown'))reasons.push(reason);};
 missing([q.fixture.provider_fixture_id,q.fixture.identity_mapping_ref,q.fixture.fixture_context_version,q.fixture.home_team_id,q.fixture.away_team_id,q.fixture.competition_id,q.fixture.kickoff_utc],'identity_unverified');
 missing([q.bookmaker.canonical_id,q.bookmaker.provider_id,q.bookmaker.identity_mapping_ref,q.bookmaker.product_kind,q.bookmaker.jurisdiction],'unknown_book_product');
 missing([m.canonical_code,m.provider_market_id,m.provider_selection_id,m.mapping_evidence_ref,m.mapping_version,m.context,m.period,m.payoff_kind],'market_or_line_unverified');
 missing([q.source.provider_name,q.source.feed_product,q.source.endpoint_ref,q.source.collector_version,q.source.collector_run_ref,q.source.raw_content_hash,q.source.page_inventory_ref,q.source.source_sequence],'source_unverified');
 if(q.source.record_origin!=='upstream_received_response')reasons.push('source_origin_unverified');
 if(q.source.inventory_status!=='complete')reasons.push('partial_inventory');
 missing([t.provider_seen_utc,t.collector_receipt_utc,t.clock_domain_ref,t.provider_time_semantics_ref],'missing_upstream_clock');
 if(q.state.suspension==='suspended'||q.state.suspension==='closed'||q.state.availability==='withdrawn'||q.revision.change_kind==='retraction')reasons.push('suspended_or_withdrawn');else if(q.state.suspension!=='active'||q.state.availability!=='offered'||!q.state.status_evidence_ref)reasons.push('status_unknown');
 if(q.settlement.rules_status!=='verified'||q.settlement.scope!=='regulation_90_plus_stoppage_excluding_extra_time_and_penalties'||[q.settlement.bookmaker_rules_ref,q.settlement.rules_version,q.settlement.rules_hash,q.settlement.rules_received_utc,q.settlement.postponement_policy_ref,q.settlement.abandonment_policy_ref,q.settlement.void_policy_ref,q.settlement.rules_compatibility_ref].some(v=>v===null))reasons.push('rules_unverified');
 if(q.accessibility.status!=='verified_accessible'||[q.accessibility.access_evidence_ref,q.accessibility.operator_policy_ref,q.accessibility.verified_utc].some(v=>v===null))reasons.push('inaccessible_or_unverified');if(!q.accessibility.source_rights_ref)reasons.push('source_rights_unresolved');
 if(q.bookmaker.product_kind!=='sportsbook'||q.price.commission_rate!==0||!q.price.cost_policy_ref||!q.price.offer_terms_ref)reasons.push('unknown_or_unsupported_costs');
 if(!p.decisionAt||!p.maxSeenAgeMs)reasons.push('freshness_policy_missing');else{const now=instant(p.decisionAt);if(!q.fixture.kickoff_utc||now>=instant(q.fixture.kickoff_utc))reasons.push('fixture_started_or_changed');for(const[k,v]of Object.entries(t))if(k.endsWith('_utc')&&v!==null&&instant(v)>now)reasons.push('future_or_inconsistent_clock');for(const v of [q.accessibility.verified_utc,q.settlement.rules_received_utc])if(v!==null&&instant(v)>now)reasons.push('future_or_inconsistent_clock');if(t.provider_seen_utc!==null&&now-instant(t.provider_seen_utc)>BigInt(p.maxSeenAgeMs)*1000n)reasons.push('stale_seen_evidence');if(t.collector_receipt_utc!==null&&now-instant(t.collector_receipt_utc)>BigInt(p.maxSeenAgeMs)*1000n)reasons.push('stale_collector_receipt');}
 const legacy=q.source.record_origin==='legacy_database_snapshot';if(legacy)reasons.push('legacy_no_first_receipt');
 return freeze({category:legacy?'research_only_normalized_quote':reasons.length===2?'future_source_verifiable_candidate':'quarantined',origin_class:legacy?'historical_observation':'source_observation_claim',actionable:false,verification:'unverified_claims',reasons:[...new Set(reasons)]});
}
function identity(q){return hash({fixture:q.fixture,bookmaker:q.bookmaker,market:q.market,source:{provider:q.source.provider_name,feed:q.source.feed_product,origin:q.source.record_origin}});}
function equalPrice(a,b){const x=decimal(a.price.decimal_text),y=decimal(b.price.decimal_text);return x.numerator*y.denominator===y.numerator*x.denominator;}
export function replayQuotes(records,options={}){
 policy(options);if(!Array.isArray(records)||records.length>LIMITS.history)throw Error('history_limit');const history=[],streams=new Map(),observations=new Map(),revisionIds=new Map(),identityStreams=new Map();let inventoryBlocked=false;
 for(let index=0;index<records.length;index++){
  const record=safeClone(records[index]);if(record?.type==='inventory_barrier'){if(Object.keys(record).length!==4||!['type','source_ref','status','received_utc'].every(k=>Object.hasOwn(record,k))||!['partial','unavailable'].includes(record.status))throw Error('inventory_barrier_contract');text(record.source_ref);instant(record.received_utc);if(options.decisionAt&&instant(record.received_utc)>instant(options.decisionAt))throw Error('future_inventory_barrier');inventoryBlocked=true;history.push({index,event:'inventory_barrier',barrier:freeze(record),hash:hash(record)});continue;}
  const q=validateQuote(record),h=quoteHash(q),key=q.stream_id??'unbound:'+q.observation_id,prior=streams.get(key),existing=observations.get(q.observation_id);let conflict=false,event='initial';
  if(['partial','unavailable'].includes(q.source.inventory_status))inventoryBlocked=true;
  const bound=identity(q),sameIdentity=identityStreams.get(bound);if(sameIdentity!==undefined&&sameIdentity!==key){conflict=true;const other=streams.get(sameIdentity);if(other)other.conflict=true;}else identityStreams.set(bound,key);
  for(const ref of [q.revision.previous_observation_ref,q.revision.supersedes_ref,q.revision.retracts_ref]){const referenced=ref===null?null:observations.get(ref);if(referenced&&referenced.stream!==key){conflict=true;const other=streams.get(referenced.stream);if(other)other.conflict=true;}}
  if(existing){if(existing.hash===h){history.push({index,event:'duplicate',observation_id:q.observation_id,hash:h,quote:q});continue;}conflict=true;event='conflicting_duplicate';const oldStream=streams.get(existing.stream);if(oldStream)oldStream.conflict=true;}
  if(revisionIds.has(q.revision.revision_id)&&revisionIds.get(q.revision.revision_id)!==h)conflict=true;
  if(prior){event=event==='initial'?(equalPrice(prior.quote,q)?'unchanged_price':'price_change'):event;if(identity(prior.quote)!==identity(q))conflict=true;
   const parent=q.revision.previous_observation_ref;if(parent!==prior.quote.observation_id)conflict=true;
   if(prior.quote.source.source_sequence===null||q.source.source_sequence===null||BigInt(q.source.source_sequence)<=BigInt(prior.quote.source.source_sequence))conflict=true;
   const before=prior.quote.times.collector_receipt_utc,after=q.times.collector_receipt_utc;if(before&&after&&instant(after)<instant(before))conflict=true;
  }else if(q.revision.previous_observation_ref!==null||q.revision.supersedes_ref!==null||q.revision.retracts_ref!==null)conflict=true;
  for(const ref of [q.revision.supersedes_ref,q.revision.retracts_ref])if(ref!==null&&(!prior||ref!==prior.quote.observation_id))conflict=true;
  if(q.revision.change_kind==='retraction'&&q.revision.retracts_ref===null)conflict=true;
  if(q.revision.change_kind==='correction'&&(q.revision.supersedes_ref===null||!q.revision.correction_reason))conflict=true;
  if(q.revision.change_kind==='status_change')event='status_change';if(q.revision.change_kind==='retraction')event='retraction';if(q.revision.change_kind==='correction')event='correction';
  streams.set(key,{quote:q,conflict:conflict||prior?.conflict===true});if(!existing)observations.set(q.observation_id,{hash:h,stream:key});revisionIds.set(q.revision.revision_id,h);history.push({index,event,observation_id:q.observation_id,hash:h,quote:q});
 }
 const states=[...streams].map(([stream_id,state])=>{const c=classifyQuote(state.quote,options),classification=state.conflict||inventoryBlocked?{...c,category:'quarantined',reasons:[...new Set([...c.reasons,...(state.conflict?['revision_conflict']:[]),...(inventoryBlocked?['partial_inventory']:[])])]}:c;return {stream_id,latest_observation_id:state.quote.observation_id,classification,fallback_allowed:false};});
 return freeze({version:'quote-replay-v1',actionable:false,history,streams:states});
}
