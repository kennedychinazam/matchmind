// Director-approved presentation prototype. Operates on the generated guest preview only.
// No forecast, settlement, publishing, fixture membership or eligibility predicate changes.
const replace=(html,from,to)=>{if(html.split(from).length!==2)throw Error('Build 355 presentation anchor changed');return html.replace(from,()=>to);};
export const PRESENTATION_CSS=`<style id="presentation355">
/* Original Build 355 dimensions and palette; retain safe wrapping at narrow widths. */
#scoresList .scrow{padding:11px 0;gap:7px}
#scoresList .tline,#fixtureList .tline{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:22px;padding:0}
#scoresList .crest,#fixtureList .crest{width:16px;height:16px;vertical-align:middle;margin-right:5px;line-height:16px}
#scoresList .fxteams,#fixtureList .fxteams{min-width:0}
/* Put status below the team names instead of consuming their horizontal space. */
#fixtureList .fxrow{display:grid;grid-template-columns:15px 42px minmax(0,1fr);column-gap:7px;row-gap:3px;padding:10px 0}
#fixtureList .fxrow>.mstar{grid-column:1;grid-row:1 / span 2;align-self:center}
#fixtureList .fxrow>.fxtime{grid-column:2;grid-row:1 / span 2;align-self:center}
#fixtureList .fxrow>.fxteams{grid-column:3;grid-row:1}
#fixtureList .fxrow>.predchip{grid-column:3;grid-row:2;justify-self:start;max-width:100%;white-space:normal;padding:2px 6px;font-size:.66rem;line-height:1.3}
/* Keep the 44px status target below its label, clear of both team-name lines.
   The 24px label + adjacent 10px row paddings leave 44px without stealing name taps. */
#fixtureList .fxrow>.statuschip{min-height:24px}
#fixtureList .fxrow>.statuschip::after{top:0;transform:none;height:44px;left:0;right:0}
#fixtureList .fxrow>.formflag{grid-column:2;grid-row:2}
#view-detail .hero .tname{min-width:0;overflow-wrap:anywhere}
#view-detail .hero{padding:18px 16px}
#view-detail .hero .conf{margin-bottom:6px}
#view-detail .hero.retained-forecast .conf{color:var(--muted)}
#view-detail .hero .strong{font-size:.74rem;font-weight:600}
#view-detail .analysis.published{white-space:normal;line-height:1.5;font-size:.86rem;padding-top:10px}
#view-detail .analysis.published p{margin:0 0 10px}
#view-detail .analysis.published p:last-child{margin-bottom:0}
#view-detail #verdictBox:empty{display:none}
#view-detail .plabel{overflow-wrap:anywhere;min-width:0}
#view-detail .ptrack{min-width:0}
#scoresMeta{font-size:.74rem;line-height:1.4}
</style>`;
export function restore355Presentation(html){
 html=replace(html,'</head>',PRESENTATION_CSS+'</head>');
 html=replace(html,"expired?'Pick expired':issued?pickLabel(f.pick,f.home,f.away)","issued?pickLabel(f.pick,f.home,f.away)");
 html=replace(html,"expired?'Original published forecast retained in history':issued?pct(f.prob)+' published probability':''","issued?pct(f.prob)+' published probability':''");
 html=replace(html,"$('acc-result').classList.toggle('hidden',!(available&&v));","$('acc-result').classList.toggle('hidden',!(issued&&v));");
 html=replace(html,"$('analysisHeading').textContent='Published statistical prediction';","$('analysisHeading').textContent='Statistical analysis';");
 html=replace(html,"issued?pickLabel(f.pick,f.home,f.away):'Statistical prediction unavailable'","issued?pickLabel(f.pick,f.home,f.away).replace('Draw No Bet','DNB'):'Statistical prediction unavailable'");
 html=replace(html,"const expired=forecastDisplayExpired(f);","const expired=forecastDisplayExpired(f); $('heroPick').closest('.hero').classList.toggle('retained-forecast',expired);");
 const old="$('analysisText').innerHTML=(issued?'<p>Original published prediction; not recalculated on this device.</p>':'<p>No published prediction for this match.</p>')+(issued&&!available?'<p>Retained for history; no longer a current recommendation.</p>':'')+'<p>Team history, league table and independent AI analysis are unavailable in this published edition.</p>';";
 html=replace(html,old,"$('analysisText').innerHTML=(issued?'<p>Original published selection and probabilities.</p>':'<p>No published prediction for this match.</p>')+'<p>Team form, H2H, league table, match statistics and independent AI analysis are unavailable in this edition.</p>';");
 const oldNote="if(expired){const note=document.createElement('p');note.textContent='The earlier published prediction expired after confirmed postponement or non-play beyond 48 hours of its original kickoff; the original forecast is preserved. This match may still be scheduled.';$('analysisText').prepend(note);}";
 html=replace(html,oldNote,`if(expired){
  $('heroStrong').textContent='Earlier forecast retained';$('heroStrong').classList.remove('hidden');
  const note=document.createElement('p');note.textContent=pending?'Status unresolved in this view. Settlement or supersession evidence is unavailable.':'Earlier forecast retained; consult the published record for settlement.';$('analysisText').prepend(note);
  const a=afState.archive&&afState.archive[f.fxid];if(a){const dates=document.createElement('p');dates.className='subnote';dates.textContent='Original kickoff: '+String(a.kickoff||'unavailable').slice(0,10)+' '+String(a.ktime||'')+' UTC. Current fixture: '+String(f.date||'')+' '+String(f.time||'')+' UTC.';$('analysisText').appendChild(dates);}
 }
`);
 html=replace(html,"return forecastStatusChip('Pick expired','The earlier published prediction expired after confirmed postponement or non-play beyond 48 hours of its original kickoff. The original forecast is preserved; this match may still be scheduled.');","return forecastStatusChip('Earlier forecast retained','Earlier forecast retained. This view does not establish settlement or supersession; current issued selections are separate records.');");
 return html;
}
