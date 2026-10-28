import {getExample,comparisonView} from './model.mjs';
const $=id=>document.getElementById(id),pct=p=>(p*100).toFixed(2)+'%';
function el(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x;}
const stateText={available:'AVAILABLE',pending:'PENDING',unavailable:'UNAVAILABLE',failed:'FAILED',abstained:'ABSTAINED',illustrative:'SYNTHETIC ONLY'};
function state(status){return el('span','state '+status,stateText[status]);}
function refs(ids){const box=el('div','citations');for(const id of ids){const link=el('a','',id.replaceAll('demo-',''));link.href='#evidence-'+id;link.addEventListener('click',()=>{$('source-evidence').open=true;});box.append(link);}return box;}
function render(){
 const synthetic=$('example').value==='demo';$('state-control').hidden=!synthetic;$('ai-state').disabled=!synthetic;$('demo-notice').hidden=!synthetic;
 const view=comparisonView(getExample(synthetic?'demo':'santos',synthetic?$('ai-state').value:undefined)),r=view.record;
 const fragment=document.createDocumentFragment(),fixture=el('section','fixture');fixture.setAttribute('aria-label','Fixture identity');
 const identity=el('div');identity.append(el('h2','',r.fixture.home+' vs '+r.fixture.away),el('p','context',r.fixture.competition+' · '+(r.synthetic?'Fictional fixture':'Fixture '+r.fixture.id)));
 const kickoff=el('p','time');kickoff.append(el('strong','',r.fixture.kickoff?'28 October 2026 · 22:30 UTC':'Fictional pre-match example'),document.createTextNode('90-minute markets'));fixture.append(identity,kickoff);fragment.append(fixture);
 const grid=el('div','workspace'),prob=el('section','panel');prob.id='comparison';prob.tabIndex=-1;
 const title=el('div','panel-title');title.append(el('h2','','Home / Draw / Away'),state(r.synthetic?'illustrative':'available'));prob.append(title);
 const legend=el('div','legend');for(const [label,type]of[['Build 355','engine'],['Independent AI','ai']]){const item=el('span');item.append(el('i','dot '+type+'-dot'),document.createTextNode(label));legend.append(item);}prob.append(legend);
 for(const [i,name]of [r.fixture.home,'Draw',r.fixture.away].entries()){
  const row=el('div','probability-row');row.setAttribute('role','group');row.setAttribute('aria-label',name+' probabilities');
  const top=el('div','outcome'),values=el('div','values');values.append(el('span','engine-value','Engine '+pct(r.engine.probabilities[i])),el('span','ai-value','AI '+(view.aiProbabilities?pct(view.aiProbabilities[i]):'—')));top.append(el('span','name',name),values);row.append(top);
  const track=el('div','bar-track'),bar=el('div','bar');bar.style.width=pct(r.engine.probabilities[i]);track.setAttribute('aria-hidden','true');track.append(bar);row.append(track);
  if(view.aiProbabilities){const t=el('div','bar-track'),b=el('div','bar ai');b.style.width=pct(view.aiProbabilities[i]);t.setAttribute('aria-hidden','true');t.append(b);row.append(t);const d=view.deltaPoints[i];row.append(el('p','delta','AI − engine: '+(d>0?'+':'')+d.toFixed(2)+' percentage points'));}
  else{const gap=el('div','no-ai-track');gap.setAttribute('aria-hidden','true');row.append(gap);}
  prob.append(row);
 }
 prob.append(el('p','small-note',r.synthetic?'All probabilities here are synthetic and uncalibrated.':'Original full-precision engine probabilities are preserved; display values are rounded.'));
 const selection=el('div','engine-selection'),selectionText=el('div');selectionText.append(el('p','',r.synthetic?'SYNTHETIC ENGINE SELECTION':'ORIGINAL BUILD 355 SELECTION'),el('strong','',r.engine.selection.label+' ('+r.engine.selection.code+')'));selection.append(selectionText,el('span','selection-prob',pct(r.engine.selection.probability)));prob.append(selection,el('p','small-note',(r.synthetic?'':'The stored selection retains Build 355’s original rounding. ')+'Statistical estimate only. No verified bookmaker price or value assessment is supplied.'));grid.append(prob);
 const ai=el('section','panel ai-panel');ai.setAttribute('aria-label','Independent AI analysis');const aiHead=el('div','panel-title');aiHead.append(el('h2','','Independent AI'),state(r.ai.status));ai.append(aiHead,el('p','model','GPT-6 Luna · '+(r.synthetic?'simulated state':r.ai.status==='available'?'retained independent result':'no validated response')));
 if(r.ai.status==='available'){const analysis=el('div','analysis');for(const statement of r.ai.analysis){const block=el('div');block.append(el('p','',statement.statement),refs(statement.refs));analysis.append(block);}ai.append(analysis);}
 else{const empty=el('div','empty');const headings={unavailable:'No independent forecast available',pending:'Analysis pending',failed:'Analysis failed',abstained:'The analyst abstained'};empty.append(el('h3','',headings[r.ai.status]),el('p','',r.ai.limitations[0]));ai.append(empty);}
 const risk=el('div','risk');risk.append(el('h3','','AI risk assessment'),el('p','risk-label',view.aiRisk?view.aiRisk.status.replaceAll('_',' ').toUpperCase():'NOT ASSESSED'),el('p','',view.aiRisk?view.aiRisk.explanation:'No AI risk assessment was recorded for this state.'));
 if(view.aiRisk)risk.append(refs(view.aiRisk.refs));ai.append(risk);const limits=el('ul','limits');for(const item of r.ai.limitations)limits.append(el('li','',item));ai.append(limits);grid.append(ai);fragment.append(grid);
 const decision=el('section','decision');decision.setAttribute('aria-label','MatchMind final decision');const dh=el('div','decision-head');dh.append(el('h2','','MatchMind final decision'),state(view.final.status));decision.append(dh,el('p','decision-label',view.final.label),el('p','decision-reason',view.final.reason));fragment.append(decision);
 const evidence=el('details','evidence');evidence.id='source-evidence';evidence.append(el('summary','','Supporting evidence & record identity'));const list=el('div','evidence-list');
 for(const source of r.evidence){const item=el('article','evidence-item');item.id='evidence-'+source.id;item.append(el('h3','',source.label),el('p','',source.detail));list.append(item);}evidence.append(list);
 const dl=el('dl');for(const [label,value]of[['Evidence class',r.source.classification],['Engine version','Build '+r.engine.build],['Engine generated (UTC)',r.engine.generatedAt??'Synthetic; no genuine generation timestamp'],['Earliest source receipt',r.source.earliestReceipt??'Synthetic; no genuine receipt'],['Collection completed',r.source.collectionCompleted??'Synthetic; no collection performed'],['AI model',r.ai.model+(r.synthetic?' · simulated':r.ai.status==='available'?' · retained result':' · configured; no validated result')],['AI prompt',r.ai.prompt],['AI generated (UTC)',r.ai.generatedAt??'No genuine generation timestamp']])dl.append(el('dt','',label),el('dd','',value));evidence.append(dl,el('p','evidence-note',r.source.note));fragment.append(evidence);
 $('content').replaceChildren(fragment);
}
$('example').addEventListener('change',render);$('ai-state').addEventListener('change',render);render();
