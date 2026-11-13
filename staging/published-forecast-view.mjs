// Read-only projection of distinct published selections. Never mutates fixtures or archives.
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Published-view anchor changed');return s.replace(a,()=>b);};
const VIEW=String.raw`function publishedPrediction(f){
 const c=f&&f._displayCard,p=c&&c.fxid===f.fxid&&c.prediction;
 return p&&p.pick&&typeof p.pick_prob==='number'&&p.made_at?p:null;
}
function forecastDate(f){const p=publishedPrediction(f);return p?p.kickoff:f.date;}
function forecastTime(f){const p=publishedPrediction(f);return p?p.ktime:f.time;}
function publishedSelectionKey(p,id,kind='prediction',origin=null){return JSON.stringify([kind,id,p.market,p.pick,p.kickoff,p.ktime,p.made_at,origin]);}
function publishedBadge(p,id,kind='prediction',origin=null){
 if(!p||!p.pick||typeof p.pick_prob!=='number')return '<span class="muted">–</span>';
 return '<span class="predchip" data-selection-key="'+escapeHtml(publishedSelectionKey(p,id,kind,origin))+'">'+escapeHtml(chipCode(p.pick))+' · '+probabilityPercent(p.pick_prob,0)+'</span>';
}
function showPublishedFixture(L,f,context=null){
 const p=context?context.prediction:publishedPrediction(f),kind=context?context.kind:'prediction',origin=context?context.origin:null;
 showNoAnalysis(f.home,f.away);
 $('heroHome').innerHTML=heroSide(p?p.home:f.home,'Home',f.fxid);$('heroAway').innerHTML=heroSide(p?p.away:f.away,'Away',f.fxid);setFavRow(p?p.home:f.home,p?p.away:f.away);
 setHeroMeta({comp:p&&p.lname||L.name,country:L.country,date:p?p.kickoff:f.date,time:p?p.ktime:f.time,fxid:f.fxid});
 const hero=$('heroPick').closest('.hero');hero.classList.remove('retained-forecast');
 hero.dataset.selectionKind=kind;hero.dataset.selectionKey=p?publishedSelectionKey(p,f.fxid,kind,origin):'';
 hero.dataset.originalKickoff=p?String(p.kickoff||'')+'T'+String(p.ktime||''):'';
 hero.dataset.originalProbability=p?String(p.pick_prob):'';hero.dataset.publishedAt=p&&p.made_at||'';hero.dataset.market=p&&p.market||'';
 $('heroPick').innerHTML=publishedBadge(p,f.fxid,kind,origin);$('heroConf').textContent='';$('heroStrong').textContent='';$('heroStrong').classList.add('hidden');$('heroDnb').classList.add('hidden');
 const v=p&&kind==='prediction'?probabilityVector(p.p_home,p.p_draw,p.p_away):null;
 $('outcomeRows').innerHTML=v?probRow(p.home,v.pW)+probRow('Draw',v.pD)+probRow(p.away,v.pL):'';
 $('acc-result').classList.toggle('hidden',!v);$('analysisText').textContent='';$('verdictBox').textContent='';$('acc-analysis').classList.add('hidden');
 const result=fixtureExceptionalStatus(f)?null:fixtureResult(L,f,scoreMap());if(result&&Number.isInteger(result.gh)&&Number.isInteger(result.ga)){const line=document.createElement('div');line.className='hm-dt';line.textContent='90-minute score '+result.gh+'–'+result.ga;$('heroMeta').appendChild(line);}
 setShareCard(false,null);navTo('detail');
}
function openIssuedForecast(leg){
 const row=(_sharedSlips.rows||[]).find(r=>(r.legs||[]).includes(leg));
 const b=!row&&_boardRecord.payload&&(_boardRecord.payload.rows||[]).find(r=>r.f===leg.fxid&&r.p===leg.code&&r.q===leg.p&&r.d===leg.d&&r.t===(leg.t||''));
 if(!row&&!b)return false;
 let x;for(const L of Object.values(afState.leagues)){const f=L.upcoming.find(f=>f.fxid===leg.fxid);if(f){x={L,f};break;}}
 if(!x){const s=scoreMap()[leg.fxid];if(s)x=ensureLeagueFromScore(s);}if(!x)return false;
 const p={home:leg.h,away:leg.a,lname:x.L.name,pick:leg.code,pick_prob:leg.p,market:leg.market||b&&b.m||pickMarket(leg.code),kickoff:leg.d,ktime:leg.t||'',made_at:row?null:_boardRecord.payload.builtAt};
 const origin=row?[row.day,row.tier,row.build,row.step,leg.tab,leg.rank]:[_boardRecord.payload.builtAt,b.f,b.m];
 showPublishedFixture(x.L,x.f,{prediction:p,kind:row?'issued-slip':'published-board',origin});return true;
}
`;
export function restorePublishedForecastView(html){
 const start=html.indexOf('function showPublishedFixture('),end=html.indexOf('// top scorers per league',start);if(start<0||end<start)throw Error('Published detail anchor changed');html=html.slice(0,start)+VIEW+'\n'+html.slice(end);
 const rs=html.indexOf('function renderFixtures(){'),re=html.indexOf('function renderDateNav(',rs);if(rs<0||re<rs)throw Error('Analysis render anchor changed');let render=html.slice(rs,re);
 render=render.replaceAll('f.date!==afState.selectedDate','forecastDate(f)!==afState.selectedDate').replaceAll('f.date !== afState.selectedDate','forecastDate(f) !== afState.selectedDate').replaceAll('f.date===afState.selectedDate','forecastDate(f)===afState.selectedDate');
 render=once(render,'const {timeCell, chip} = fxCells(L, f, smap);',"const p=publishedPrediction(f),timeCell='<span class=\"fxtime\">'+escapeHtml(localHM(forecastDate(f),forecastTime(f)))+'</span>',chip=publishedBadge(p,f.fxid);");
 html=html.slice(0,rs)+render+html.slice(re);
 html=once(html,"return forecastStatusChip('Pick expired','The earlier published prediction expired after confirmed postponement or non-play beyond 48 hours of its original kickoff. The original forecast is preserved; this match may still be scheduled.');",'return publishedBadge(arguments[0],arguments[1]);');
 html=once(html,'chip=expiredForecastChip();','chip=expiredForecastChip(publishedPrediction(f),f.fxid);');
 html=once(html,': _void  ? expiredForecastChip()',': _void  ? expiredForecastChip(publishedPrediction(f),f.fxid)');
 html=once(html,'? expiredForecastChip()   // build 349','? expiredForecastChip(p,p.fxid)   // presentation only');
 // Calendar archive rows keep their original kickoff and always show the published pick/probability.
 const as=html.indexOf('async function showPredictDate('),ae=html.indexOf('/* ---------- persistence',as);if(as<0||ae<as)throw Error('Archive presentation anchor changed');let archive=html.slice(as,ae);
 const cs=archive.indexOf('      const chip = done'),ce=archive.indexOf('      html += ',cs);if(cs<0||ce<cs)throw Error('Archive badge anchor changed');archive=archive.slice(0,cs)+"      const displayChip=publishedBadge(p,p.fxid);\n"+archive.slice(ce);
 archive=once(archive,"${exceptional?fixtureExceptionalTime(f):(done?`${f.gh}–${f.ga}<br><span class=\"ftl\">${f.fgh!=null?aetText(f):'FT'}</span>`:localHM(f&&f.date||d, f&&f.time||p.ktime))}","${localHM(p.kickoff,p.ktime)}");
 archive=once(archive,'${crest(p.home)}','${crest(p.home,false,p.fxid)}');archive=once(archive,'${crest(p.away)}','${crest(p.away,false,p.fxid)}');html=html.slice(0,as)+archive+html.slice(ae);
 html=once(html,"const btn = $('bankerOpen'); if(btn && r) btn.addEventListener('click', () => openFixture(r.L.id, r.f));","const btn = $('bankerOpen'); if(btn && r) btn.addEventListener('click', () => openIssuedForecast(l));");
 const ts=html.indexOf('function renderTipListFrozen('),te=html.indexOf('function renderTipList(market)',ts);const tips=once(html.slice(ts,te),"const r = refs[+row.dataset.i]; if(r) openFixture(r.L.id, r.f);","const r = refs[+row.dataset.i]; if(r) openIssuedForecast(legs[+row.dataset.i]);");html=html.slice(0,ts)+tips+html.slice(te);
 html=once(html,"const btn=$('bankerOpen'); if(btn) btn.addEventListener('click',()=>openFixture(L.id,f));","const btn=$('bankerOpen'); if(btn) btn.addEventListener('click',()=>openIssuedForecast({fxid:f.fxid,h:f.home,a:f.away,d:f.date,t:f.time,code:b.pick,p:b.prob}));");
 return html;
}
