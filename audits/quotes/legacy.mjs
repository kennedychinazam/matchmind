// Retained database JSON -> research observations. No network/writer/clock calls.
import {parseBoundedJSON,LIMITS,text,rawHash,hash,freeze,safeClone} from './bounded-json.mjs';
import {QUOTE_SCHEMA,validateQuote,instant,decimal,legacyCaptureInstant,decimalToken} from './contract.mjs';
import {canonicalMarket} from './markets.mjs';
function empty(s){if('const'in s)return s.const;if(s.enum)return s.enum.includes(null)?null:s.enum.includes('unknown')?'unknown':s.enum[0];if(Array.isArray(s.type)&&s.type.includes('null'))return null;if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,empty(v)]));if(s.type==='array')return [];return '';}
function id(v){if(typeof v==='number'&&!Number.isSafeInteger(v)||!['number','string'].includes(typeof v)||!/^[1-9][0-9]{0,17}$/.test(String(v)))throw Error('unsafe_legacy_identity');return String(v);}
export function normalizeLegacySnapshot(rawJSON,options={}){
 const opts=safeClone(options);for(const k of Object.keys(opts))if(!['sourceRef','reconnaissanceReceipt','fixtureContext'].includes(k))throw Error('legacy_option');text(opts.sourceRef);if(opts.reconnaissanceReceipt!==undefined)instant(opts.reconnaissanceReceipt);
 const {value:s,tokens}=parseBoundedJSON(rawJSON);if(!s||Array.isArray(s)||typeof s!=='object')throw Error('legacy_snapshot_object');const sid=id(s.id),fid=id(s.fxid),captured=legacyCaptureInstant(s.captured_at);if(!s.prices||Array.isArray(s.prices)||typeof s.prices!=='object')throw Error('legacy_prices_object');const context=opts.fixtureContext??null;if(context&&id(context.fxid)!==fid)throw Error('fixture_binding');if(context){for(const k of Object.keys(context))if(!['fxid','home','away','lid','lname','lcountry','season','date','time'].includes(k))throw Error('legacy_context_field');for(const k of ['home','away','lname','lcountry'])if(context[k]!==undefined&&context[k]!==null)text(context[k],128);}
 const books=Object.entries(s.prices);if(books.length>LIMITS.books)throw Error('legacy_books_limit');for(const [book,values]of books){text(book,128);if(!values||Array.isArray(values)||typeof values!=='object'||Object.keys(values).length>LIMITS.marketsPerBook)throw Error('legacy_book_market_structure');}
 const bytesHash=rawHash(rawJSON),quotes=[],rejections=[];
 for(const[book,values]of books)for(const[code,price]of Object.entries(values)){
  const token=tokens.get(JSON.stringify(['prices',book,code]));let market,priceText;
  try{market=canonicalMarket(code);if(typeof price!=='number'||!Number.isFinite(price))throw Error('legacy_non_numeric_price');priceText=decimalToken(token);}catch(e){rejections.push({bookmaker_display_name:book,legacy_code:code,original_json_token:token,reason:e.message,source_ref:opts.sourceRef,snapshot_id:sid});continue;}
  const q=empty(QUOTE_SCHEMA);q.observation_id='legacy:'+hash({snapshot_bytes:bytesHash,book,code});q.stream_id='legacy-stream:'+hash({fixture:fid,book,code});q.source_quote_id=null;
  Object.assign(q.fixture,{matchmind_fixture_id:fid,competition_id:context?.lid==null?null:String(context.lid),competition_name:context?.lname??null,country:context?.lcountry??null,season:context?.season==null?null:String(context.season),home_name:context?.home??null,away_name:context?.away??null,fixture_context_version:context?'retained-context:'+hash(context):null});
  if(context?.date&&context?.time){const time=context.time.length===5?context.time+':00':context.time;q.fixture.kickoff_utc=context.date+'T'+time+'Z';instant(q.fixture.kickoff_utc);}
  q.bookmaker.display_name=book;q.market={...market};Object.assign(q.price,{decimal_text:priceText,representation_origin:'stored_json_numeric'});
  Object.assign(q.source,{source_response_ref:opts.sourceRef,raw_content_hash:bytesHash,record_origin:'legacy_database_snapshot',inventory_status:'unknown'});
  Object.assign(q.times,{legacy_captured_at_utc:captured,reconnaissance_receipt_utc:opts.reconnaissanceReceipt??null});q.state.observation_purpose='historical_snapshot';
  Object.assign(q.revision,{revision_id:q.observation_id,change_kind:'initial_observation',original_source_record_ref:opts.sourceRef});
  q.legacy={snapshot_id_value:s.id,fixture_id_value:s.fxid,bookmaker_display_name:book,market_code:code,stored_price_value:price,stored_price_json_token:token,captured_at_original:s.captured_at??null,source_observation_ref:opts.sourceRef};
  q.limitations=['historical_database_observation','nominal_market_mapping_only','upstream_original_representation_unavailable','no_trusted_first_receipt','book_identity_unverified','availability_rules_access_rights_unknown'];quotes.push(validateQuote(q));
 }
 return freeze({source:{source_ref:opts.sourceRef,snapshot_id:sid,fixture_id:fid,snapshot_bytes_sha256:bytesHash,raw_snapshot_json:rawJSON},quotes,rejections});
}
