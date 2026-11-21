import{validateLogos}from'./original-logos.mjs';
export function restoreOriginalLogos(html,catalog){
 validateLogos(catalog);
 const data=JSON.stringify(catalog).replaceAll('<','\\u003c').replaceAll('&','\\u0026');
 html=html.replace('<head>','<head><script id="originalLogoCatalog" type="application/json">'+data+'</script>');
 const start=html.indexOf('function crest(name, big=false){'),end=html.indexOf('// fallback analysis via API-Football',start);if(start<0||end<start)throw Error('Original branding anchors changed');
 const renderer=`const originalLogoCatalog=JSON.parse(document.getElementById('originalLogoCatalog').textContent);
const originalFixtureLogos=new Map(originalLogoCatalog.fixtures.map(f=>[f.fxid,f]));
const originalTeamLogos=new Map(),originalLeagueLogos=new Map();
for(const f of originalLogoCatalog.fixtures){for(const[n,u]of[[f.home,f.home_logo],[f.away,f.away_logo]]){if(!originalTeamLogos.has(n))originalTeamLogos.set(n,u);else if(originalTeamLogos.get(n)!==u)originalTeamLogos.set(n,null);}if(f.llogo)originalLeagueLogos.set(f.lid,f.llogo);}
function crest(name,big=false,fxid=null){
 const f=originalFixtureLogos.get(Number(fxid));const u=f?(f.home===name?f.home_logo:f.away===name?f.away_logo:null):originalTeamLogos.get(name);
 const cls='crest'+(big?' big':'');return u?'<img class="'+cls+'" src="'+escapeHtml(u)+'" alt="'+escapeHtml(name)+' crest" loading="lazy" onerror="this.style.visibility=\\'hidden\\'">':'<span class="'+cls+'" role="img" aria-label="Crest unavailable" title="Crest unavailable"></span>';
}
function competitionBadge(L){const u=originalLeagueLogos.get(Number(L.id??L.lid));return u?'<img class="competition-logo" src="'+escapeHtml(u)+'" alt="Competition logo" style="width:18px;height:18px;border-radius:4px;object-fit:contain" onerror="this.style.visibility=\\'hidden\\'">':'';}
function heroSide(name,label,fxid=null){return crest(name,true,fxid)+'<div>'+escapeHtml(name)+'</div><div class="venue">'+escapeHtml(label)+'</div>';}
\n`;
 html=html.slice(0,start)+renderer+html.slice(end);
 for(const side of['home','away']){
  html=html.replaceAll('crest(s.'+side+')','crest(s.'+side+',false,s.fxid)').replaceAll('crest(f.'+side+')','crest(f.'+side+',false,f.fxid)');
  const label=side==='home'?'Home':'Away';html=html.replaceAll("heroSide(f."+side+",'"+label+"')","heroSide(f."+side+",'"+label+"',f.fxid)");
 }
 return html;
}
