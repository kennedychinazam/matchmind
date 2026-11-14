import {restorePublishedForecastView} from './published-forecast-view.mjs';
// Director-approved presentation prototype. Operates on the generated guest preview only.
// No forecast, settlement, publishing, fixture membership or eligibility predicate changes.
const replace=(html,from,to)=>{if(html.split(from).length!==2)throw Error('Build 355 presentation anchor changed');return html.replace(from,()=>to);};
export const PRESENTATION_CSS=`<style id="presentation355">
/* Original Build 355 dimensions and palette; retain safe wrapping at narrow widths. */
#scoresList .scrow{padding:11px 0;gap:7px}
#scoresList .tline,#fixtureList .tline{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.5;padding:1px 0}
#scoresList .crest,#fixtureList .crest{width:20px;height:20px;vertical-align:-5px;margin-right:7px}
#scoresList .fxteams,#fixtureList .fxteams{min-width:0}
/* Restore Build 355's original inline row and right-hand pick badge. */
#fixtureList .fxrow{display:flex;align-items:center;gap:7px;padding:12px 0}
#fixtureList .fxrow>.mstar{flex:0 0 15px}
#fixtureList .fxrow>.fxtime{flex:0 0 42px}
#fixtureList .fxrow>.fxteams{flex:1;min-width:0}
#fixtureList .fxrow>.predchip{flex:0 0 auto;max-width:none;white-space:nowrap;padding:5px 9px;font-size:.74rem;line-height:1.3}
#fixtureList .fxrow>.predchip.muted-chip{max-width:34%;white-space:normal;font-size:.64rem;min-width:0}
#fixtureList .fxrow>.statuschip{max-width:34%;white-space:normal;font-size:.64rem}
#fixtureList .fxrow>.statuschip::after{top:50%;transform:translateY(-50%);height:44px;left:-3px;right:-3px}
@media(max-width:360px){#fixtureList .fxrow{gap:5px}#fixtureList .fxrow>.fxtime{flex-basis:36px;width:36px}#fixtureList .fxrow>.predchip{padding:4px 6px;font-size:.68rem}#fixtureList .fxrow>.predchip.muted-chip{max-width:28%;font-size:.62rem}#fixtureList .fxteams{font-size:.86rem}}
#view-detail .hero .tname{min-width:0;overflow-wrap:anywhere}
#view-detail .hero{padding:18px 16px}
#view-detail .hero .conf{margin-bottom:6px}
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
 html=replace(html,'function skillBadge(L){',"function skillBadge(L){ return ''; // Director: no EDGE/ranking decorations.\n");
 return restorePublishedForecastView(html);
}
