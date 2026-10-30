import {santos,demo} from './data.mjs';
const statuses=new Set(['available','pending','unavailable','failed','abstained']);
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function keys(x,allowed){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!==[...allowed].sort().join())throw Error('invalid_preview_contract');}
function text(x,max=2000){if(typeof x!=='string'||!x.trim()||x.length>max)throw Error('invalid_preview_text');}
function time(x){if(x!==null&&(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT.*Z$/u.test(x)||!Number.isFinite(Date.parse(x))))throw Error('invalid_preview_timestamp');}
function probabilities(p){if(!Array.isArray(p)||p.length!==3||p.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('invalid_preview_probabilities');}
export function validateRecord(r){
 keys(r,['version','synthetic','fixture','engine','ai','evidence','source','final']);if(r.version!=='prediction-comparison-preview-v1'||typeof r.synthetic!=='boolean')throw Error('invalid_preview_version');
 keys(r.fixture,['id','home','away','competition','kickoff']);for(const k of ['id','home','away','competition'])text(r.fixture[k],150);time(r.fixture.kickoff);
 keys(r.engine,['build','generatedAt','probabilities','selection']);if(r.engine.build!==355)throw Error('original_build_required');time(r.engine.generatedAt);probabilities(r.engine.probabilities);
 keys(r.engine.selection,['code','label','probability']);text(r.engine.selection.code,8);text(r.engine.selection.label,150);if(typeof r.engine.selection.probability!=='number'||!Number.isFinite(r.engine.selection.probability)||r.engine.selection.probability<0||r.engine.selection.probability>1)throw Error('invalid_engine_selection');
 if(!Array.isArray(r.evidence)||!r.evidence.length||r.evidence.length>30)throw Error('bounded_preview_evidence_required');const refs=new Set();
 for(const e of r.evidence){keys(e,['id','label','detail','receivedAt']);text(e.id,100);text(e.label,150);text(e.detail);time(e.receivedAt);if(refs.has(e.id))throw Error('duplicate_preview_reference');refs.add(e.id);}
 const cite=list=>{if(!Array.isArray(list)||!list.length||list.length>30||new Set(list).size!==list.length||list.some(id=>!refs.has(id)))throw Error('unsupported_preview_reference');};
 keys(r.ai,['status','model','prompt','generatedAt','probabilities','analysis','risk','limitations']);if(!statuses.has(r.ai.status))throw Error('invalid_ai_status');text(r.ai.model,100);text(r.ai.prompt,100);time(r.ai.generatedAt);
 if(!Array.isArray(r.ai.analysis)||r.ai.analysis.length>20||!Array.isArray(r.ai.limitations)||!r.ai.limitations.length||r.ai.limitations.length>20)throw Error('bounded_analysis_required');r.ai.limitations.forEach(x=>text(x));
 for(const a of r.ai.analysis){keys(a,['statement','refs']);text(a.statement);cite(a.refs);}
 if(r.ai.risk!==null){keys(r.ai.risk,['status','explanation','refs']);if(!['concern','insufficient_evidence'].includes(r.ai.risk.status))throw Error('invalid_risk_status');text(r.ai.risk.explanation);cite(r.ai.risk.refs);}
 if(r.ai.status==='available'){probabilities(r.ai.probabilities);if(!r.ai.analysis.length||!r.ai.risk)throw Error('complete_ai_analysis_required');}
 else if(r.ai.probabilities!==null||r.ai.analysis.length||r.final!==null||r.ai.generatedAt!==null||r.ai.status!=='abstained'&&r.ai.risk!==null)throw Error('inconsistent_missing_ai');
 if(r.ai.status==='abstained'&&r.ai.risk?.status!=='insufficient_evidence')throw Error('typed_abstention_required');
 keys(r.source,['classification','earliestReceipt','collectionCompleted','note']);text(r.source.classification,150);text(r.source.note);time(r.source.earliestReceipt);time(r.source.collectionCompleted);
 if(r.final!==null){keys(r.final,['status','label','reason']);if(!r.synthetic||r.ai.status!=='available'||r.final.status!=='illustrative')throw Error('unapproved_final_decision');text(r.final.label,150);text(r.final.reason);}
 return r;
}
const real=freeze(validateRecord(santos));
const examples=new Map([...statuses].map(status=>{
 const r=structuredClone(demo);r.ai.status=status;
 if(status!=='available'){
  Object.assign(r.ai,{probabilities:null,analysis:[],risk:null,generatedAt:null});r.final=null;
  r.ai.limitations=[{pending:'Illustrative pending state. No request is running.',unavailable:'Illustrative unavailable state. No AI result exists.',failed:'Illustrative failure. No validated response is available.',abstained:'Illustrative model abstention: insufficient chance-quality evidence.'}[status],'Synthetic demonstration only.'];
  if(status==='abstained')r.ai.risk={status:'insufficient_evidence',explanation:'The fictional sample lacks sufficient chance-quality evidence for a probability assessment.',refs:['demo-home-form','demo-away-form']};
 }
 return[status,freeze(validateRecord(r))];
}));
export function getExample(id,status){
 if(id==='santos'){if(status!==undefined&&status!=='unavailable')throw Error('genuine_ai_state_cannot_be_changed');return real;}
 if(id!=='demo'||!examples.has(status??'available'))throw Error('unknown_preview_example');return examples.get(status??'available');
}
export function comparisonView(record){
 const r=validateRecord(record),available=r.ai.status==='available';
 return freeze({record:r,aiProbabilities:available?r.ai.probabilities:null,aiRisk:r.ai.risk,deltaPoints:available?r.ai.probabilities.map((p,i)=>Number(((p-r.engine.probabilities[i])*100).toFixed(8))):null,
 final:r.final??{status:r.ai.status==='available'?'unavailable':r.ai.status,label:r.ai.status==='abstained'?'No decision — AI abstained':'Final decision unavailable',reason:'An independent, validated AI assessment and a separately approved final-decision policy are required. No combined forecast or value recommendation is generated.'}});
}
