import {load} from './lib.mjs';
import {simulate} from './slips.mjs';
const OLD=load('/tmp/claude-0/calbt/dumpOld.json').rows, NEW=load('/tmp/claude-0/calbt/dumpNew.json').rows;
const sh=v=>(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p+v)):p;
const V=[['BEFORE 365: floor 0.65, preferGoals',OLD,sh(-0.0175),{floorLO:0.65,preferGoals:true}],
 ['AFTER 366: floor 0.70, no preferGoals',NEW,sh(-0.03),{floorLO:0.70,preferGoals:false}],
 ['366 goals, floor 0.72',NEW,sh(-0.03),{floorLO:0.72,floorHI:0.72,preferGoals:false}],
 ['366 goals, floor 0.65 (for contrast)',NEW,sh(-0.03),{floorLO:0.65,preferGoals:false}]];
for(const m of ['0.95','0.92']){ process.env.MARGIN=m; }
for(const [n,rs,cal,o] of V) for(const [w,f] of [['2025-07 on','2025-07-01'],['2026-08 on','2026-08-01']]){ const s=simulate(rs,cal,{...o,from:f}); console.log(n.padEnd(40),w); for(const [k,v] of Object.entries(s)) console.log(`   ${k.padEnd(6)} built ${v.built}/${v.days} days, card win ${v.win}% vs stated ${v.stated}%, legs ${v.legHit}% vs ${v.legStated}%, mix ${JSON.stringify(v.mix)}`); }
