import {load} from './lib.mjs';
const D=load(); console.log(D.build,D.rows.length,'names',D.rows.filter(r=>r.home).length,'fixed90',D.fixed,'priced',D.priced);
console.log(D.rows.filter(r=>r.odds).slice(-2));
