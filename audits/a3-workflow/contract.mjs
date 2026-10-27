import {readSource} from './authority.mjs';
import {evidenceView} from '../phase8-continuation/protocol.mjs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {safeClone,freeze} from '../a4/bounds.mjs';
import {validateFootballText} from '../a4/text-policy.mjs';
export const FIELD_DICTIONARY=freeze({fxid:'source fixture identifier',lid:'source competition identifier',home:'source home identity label',away:'source away identity label',lname:'source competition identity label',lcountry:'source country identity label',provider:'source provider identifier',season:'source season number',date:'fixture calendar date in UTC',time:'fixture kickoff clock in UTC',status:'source normalized status; FINISHED does not prove 90-minute settlement',gh:'source final home goals; regulation semantics not independently certified',ga:'source final away goals; regulation semantics not independently certified',ft_h:'source fulltime home goals; nullable, period compatibility unverified',ft_a:'source fulltime away goals; nullable, period compatibility unverified',ht_h:'source halftime home goals; nullable',ht_a:'source halftime away goals; nullable',xg_h:'xG-labeled source home value; measured-provider semantics unverified',xg_a:'xG-labeled source away value; measured-provider semantics unverified',inj_h:'opaque source player-ID tokens; not verified named absences or impact',inj_a:'opaque source player-ID tokens; not verified named absences or impact'});
const packets=new WeakSet(),packetSources=new WeakMap(),finished=new Set(['FINISHED','FT']),unplayed=new Set(['NS','SCHEDULED','CANCELLED','POSTPONED']);
const scoreFields=['gh','ga','ft_h','ft_a','ht_h','ht_a'],numberFields=[...scoreFields,'xg_h','xg_a'];
const positive=x=>Number.isSafeInteger(x)&&x>0;
export function assertPacket(p){if(!packets.has(p))throw Error('unadmitted_a3_packet');return p;}
export function readPacketSource(p){assertPacket(p);return packetSources.get(p);}
export function buildPacket(cap,fixtureId){
 const {source:s,receipt,classification,source_hash}=readSource(cap),id=Number(fixtureId);
 if(s.schema_version!==1||s.history_complete!==true||!Array.isArray(s.rows)||s.rows.length>100000||!Array.isArray(s.targets)||!s.targets.includes(id))throw Error('complete_declared_source_required');
 const targets=s.rows.filter(r=>r.fxid===id);if(targets.length!==1)throw Error('fixture_identity');const target=targets[0];
 const rows=s.rows.filter(r=>r.lid===target.lid),seen=new Set();
 if(rows.length>10000)throw Error('complete_competition_capacity_no_truncation');
 for(const r of rows){
  if(Object.keys(r).some(k=>!Object.hasOwn(FIELD_DICTIONARY,k))||!Object.keys(FIELD_DICTIONARY).every(k=>Object.hasOwn(r,k)))throw Error('closed_football_field_allowlist');
  if(!positive(r.fxid)||!positive(r.lid)||!Number.isSafeInteger(r.season)||seen.has(r.fxid))throw Error('fixture_identity');seen.add(r.fxid);
  for(const k of ['home','away','lname','lcountry']){if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>128)throw Error('football_identity');validateFootballText(r[k],'identity_label');}
  if(r.home===r.away||typeof r.provider!=='string'||r.provider.length>64)throw Error('fixture_orientation');validateFootballText(r.provider,'identifier');
  if(!/^\d{4}-\d{2}-\d{2}$/u.test(r.date)||!/^\d{2}:\d{2}$/u.test(r.time))throw Error('fixture_time');
  const played=epochMicros(r.date+'T'+r.time+':00Z');
  if(!finished.has(r.status)&&!unplayed.has(r.status))throw Error('unsupported_fixture_status');
  for(const k of numberFields)if(r[k]!==null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1000||scoreFields.includes(k)&&!Number.isSafeInteger(r[k])))throw Error('football_numeric_field');
  for(const k of ['inj_h','inj_a'])if(typeof r[k]!=='string'||r[k].length>4096||!/^[0-9? ]*$/u.test(r[k]))throw Error('opaque_injury_tokens_only');
  if(finished.has(r.status)){if(played>=epochMicros(receipt)||r.gh===null||r.ga===null)throw Error('post_receipt_or_incomplete_result');}
  else if(numberFields.some(k=>r[k]!==null))throw Error('unplayed_fixture_result_leakage');
 }
 const kickoff=target.date+'T'+target.time+':00Z';
 if(!['NS','SCHEDULED'].includes(target.status)||epochMicros(receipt)>=epochMicros(kickoff))throw Error('target_not_pre_match');
 const evidence=evidenceView(s,id,receipt);
 const body={version:'a3-football-evidence-v1',fixture:{fixture_id:String(id),home:target.home,away:target.away,competition_id:String(target.lid),competition:target.lname,country:target.lcountry,kickoff_at_utc:kickoff},source:{source_hash,received_at_utc:receipt,source_read_at_utc:s.source_read_at_utc,classification},certified_prospective:false,field_dictionary:FIELD_DICTIONARY,evidence,limitations:['complete_competition_as_collected_not_all_provider_history','historical_values_available_by_this_aggregate_receipt_only','normalized_finished_status_does_not_certify_regulation_labels','xg_measured_provider_semantics_unverified','opaque_injury_tokens_not_verified_player_availability','no_verified_tactics_lineups_travel_or_current_news','probability_calibration_not_validated']};
 const p=freeze(safeClone({...body,packet_hash:canonicalHash(body)}));packets.add(p);packetSources.set(p,s);return p;
}
