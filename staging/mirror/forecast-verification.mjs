// Hosted-acceptance oracle only. No app/model/settlement behavior is changed.
export function datedForecastExpectation(card){
 const p=card?.prediction;if(!p||typeof p.pick_prob!=='number'||!p.pick||!p.made_at)throw Error('Published forecast evidence required');
 const code=p.pick,label=({'1D':'1 DNB','2D':'2 DNB',O15:'O15',U15:'U15',O25:'O2.5',U25:'U2.5',O35:'O35',U35:'U3.5',BTS:'BTTS',NBT:'NoBTTS'})[code]||code;
 const probability=String(p.pick_prob),pendingBadge=label+' · '+Math.round(p.pick_prob*100)+'%';
 const identity={selectionKey:JSON.stringify(['prediction',card.fxid,p.market,p.pick,p.kickoff,p.ktime,p.made_at,null]),probability,
  kickoff:p.kickoff+'T'+(p.ktime||''),publishedAt:p.made_at,pendingBadge};
 const pending=outcome=>({...identity,outcome,graded:false,badge:pendingBadge});
 if(p.withheld_at)return pending(null);
 const finished=['FT','FINISHED','AET','PEN'].includes(card.status);
 let h=card.ft_h,a=card.ft_a;
 if(!['AET','PEN'].includes(card.status)){h??=card.gh;a??=card.ga;}
 if(!finished||![h,a].every(n=>Number.isInteger(n)&&n>=0))return pending('Pending');
 const original=Date.parse(p.kickoff+'T'+(p.ktime||'00:00')+':00Z'),current=Date.parse(card.date+'T'+(card.time||'00:00')+':00Z');
 if(!Number.isFinite(original)||!Number.isFinite(current)||current-original>=48*3600000)return pending('Unsettled');
 const result=h>a?'1':h===a?'X':'2';let outcome;
 if(code==='1D'||code==='2D')outcome=result==='X'?'Void':result===code[0]?'Won':'Lost';
 else if(['1','X','2','1X','X2','12'].includes(code))outcome=code.includes(result)?'Won':'Lost';
 else if(/^[OU][123]5$/.test(code)){const line=Number(code.slice(1))/10;outcome=(code[0]==='O'?h+a>line:h+a<line)?'Won':'Lost';}
 else if(code==='BTS'||code==='NBT')outcome=((h>0&&a>0)===(code==='BTS'))?'Won':'Lost';
 else throw Error('Unsupported dated forecast market in acceptance evidence');
 return{...identity,outcome,graded:true,badge:label+{Won:' ✓',Lost:' ✗',Void:' · Void'}[outcome]};
}
