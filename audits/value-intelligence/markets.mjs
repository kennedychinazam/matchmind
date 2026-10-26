// All fourteen probabilities derive from the same normalized regulation-time grid.
import {compensatedSum,deepFreeze} from './scoreline.mjs';
export const MARKET_CODES=Object.freeze(['HOME','DRAW','AWAY','DC_1X','DC_12','DC_X2','BTTS_YES','BTTS_NO','OVER_1_5','UNDER_1_5','OVER_2_5','UNDER_2_5','OVER_3_5','UNDER_3_5']);
export function marketProbabilities(distribution){
 const d=distribution,h=d?.support?.homeMax,a=d?.support?.awayMax;
 if(d?.version!=='coherent-scoreline-v1'||!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h<0||a<0||h>256||a>256||!Array.isArray(d.cells)||d.cells.length!==(h+1)*(a+1))throw Error('complete rectangular score distribution required');
 for(let i=0;i<d.cells.length;i++){
  const c=d.cells[i];if(!c||c.home!==Math.floor(i/(a+1))||c.away!==i%(a+1)||typeof c.probability!=='number'||!Number.isFinite(c.probability)||c.probability<0||c.probability>1)throw Error('invalid score cell or order');
 }
 const mass=compensatedSum(d.cells.map(c=>c.probability));
 // Validate normalization independently; caller-supplied metadata cannot excuse
 // a malformed grid. This tolerance is roundoff, not the discarded-tail allowance.
 if(Math.abs(mass-1)>64*Number.EPSILON)throw Error('score cells must have normalized mass');
 const sum=predicate=>compensatedSum(d.cells.filter(predicate).map(c=>c.probability));
 const unit=x=>{if(!Number.isFinite(x)||x<-64*Number.EPSILON||x>1+64*Number.EPSILON)throw Error('invalid aggregated probability');return Math.max(0,Math.min(1,x));};
 // Sum both sides; preserve the smaller directly and complement only the larger.
 // 1-nearOne would erase tiny possible events despite a complete retained grid.
 const binary=predicate=>{const yes=unit(sum(predicate)),no=unit(sum(c=>!predicate(c)));return yes<=no?[yes,unit(1-yes)]:[unit(1-no),no];};
 const HOME=sum(c=>c.home>c.away),DRAW=sum(c=>c.home===c.away),AWAY=sum(c=>c.home<c.away),[BTTS_YES,BTTS_NO]=binary(c=>c.home>0&&c.away>0);
 const p={HOME:unit(HOME),DRAW:unit(DRAW),AWAY:unit(AWAY),DC_1X:unit(HOME+DRAW),DC_12:unit(HOME+AWAY),DC_X2:unit(DRAW+AWAY),BTTS_YES,BTTS_NO};
 for(const k of [1,2,3]){const[under,over]=binary(c=>c.home+c.away<=k);p[`OVER_${k}_5`]=over;p[`UNDER_${k}_5`]=under;}
 return deepFreeze(p);
}
