// Stage 1 offline research mathematics. No model fitting, IO, odds, selector or transport.
// Analytical tail majorants and an explicitly separate floating-point allowance;
// this is not a formal interval implementation of the platform's Math.exp.
export function compensatedSum(values){
 let sum=0,correction=0;
 for(const value of values){const y=value-correction,next=sum+y;correction=(next-sum)-y;sum=next;}
 return sum;
}
export function deepFreeze(value){
 if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}
 return value;
}
const plain=x=>x!==null&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype;
function onlyKeys(value,allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('unsupported scoreline parameters or options');}
function marginal(rate,tolerance,maxGoals){
 if(rate===0)return{probabilities:[1],tail:0};
 const probabilities=[Math.exp(-rate)];
 for(let k=0;k<=maxGoals;k++){
  const next=probabilities[k]*rate/(k+1),ratio=rate/(k+2);
  // For j >= k+1, successive term ratios decrease. A geometric series therefore
  // majorizes the omitted Poisson survival mass, without 1-roundedCDF cancellation.
  // Retain at least one possible cell for every approved total event, including
  // over 3.5 when the other side has rate zero, even if that event is below tol.
  if(k>=4&&ratio<1){
   const tail=next/(1-ratio)*(1+64*Number.EPSILON)+Number.MIN_VALUE;
   if(tail<=tolerance)return{probabilities,tail};
  }
  if(k===maxGoals)break;
  probabilities.push(next);
 }
 throw Error('requested Poisson tail bound exceeds available support');
}
export function scorelineDistribution(parameters,options={}){
 onlyKeys(parameters,['lambdaHome','lambdaAway','rho']);onlyKeys(options,['tailTolerance','maxGoals']);
 const {lambdaHome:h,lambdaAway:a,rho=0}=parameters;
 if(![h,a].every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=20))throw Error('finite scoring rates in [0,20] required');
 if(typeof rho!=='number'||!Number.isFinite(rho)||Math.abs(rho)>1)throw Error('finite rho in [-1,1] required');
 const tau=[1-h*a*rho,1+h*rho,1+a*rho,1-rho];
 if(tau.some(t=>!Number.isFinite(t)||t<0))throw Error('inadmissible Dixon-Coles dependence; no clipping or fallback');
 const {tailTolerance=1e-12,maxGoals=128}=options;
 if(typeof tailTolerance!=='number'||!Number.isFinite(tailTolerance)||tailTolerance<1e-14||tailTolerance>1e-4)throw Error('tailTolerance must be within [1e-14,1e-4]');
 if(!Number.isSafeInteger(maxGoals)||maxGoals<0||maxGoals>256)throw Error('maxGoals must be an integer within [0,256]');
 const hp=marginal(h,tailTolerance/2,maxGoals),ap=marginal(a,tailTolerance/2,maxGoals),cells=[];
 for(let home=0;home<hp.probabilities.length;home++)for(let away=0;away<ap.probabilities.length;away++){
  const correction=home===0&&away===0?tau[0]:home===0&&away===1?tau[1]:home===1&&away===0?tau[2]:home===1&&away===1?tau[3]:1;
  cells.push({home,away,probability:hp.probabilities[home]*ap.probabilities[away]*correction});
 }
 const retainedMass=compensatedSum(cells.map(c=>c.probability)),analyticTailUpperBound=hp.tail+ap.tail;
 // Conservative engineering allowance for recurrence, products, tau, compensated
 // sums and normalization on the bounded domain, assuming ordinary binary64
 // arithmetic and a near-ulp Math.exp. Cross-checked against independent decimals;
 // not a formally proved bound on every ECMAScript engine's transcendental library.
 const floatingPointAllowance=32*Number.EPSILON*(hp.probabilities.length+ap.probabilities.length+4)+4e-15;
 if(!Number.isFinite(retainedMass)||retainedMass<=0||retainedMass>1+floatingPointAllowance||1-retainedMass>analyticTailUpperBound+floatingPointAllowance)throw Error('score distribution mass violates numerical allowance');
 for(const cell of cells)cell.probability/=retainedMass;
 return deepFreeze({version:'coherent-scoreline-v1',family:rho===0?'independent-poisson':'dixon-coles',parameters:{lambdaHome:h,lambdaAway:a,rho},
  support:{homeMax:hp.probabilities.length-1,awayMax:ap.probabilities.length-1},cells,
  normalization:{retainedMass,factor:1/retainedMass,interpretation:'conditional_on_retained_grid'},
  error:{requestedTailTolerance:tailTolerance,homeTailUpperBound:hp.tail,awayTailUpperBound:ap.tail,analyticTailUpperBound,floatingPointAllowance,
   eventProbabilityAllowance:analyticTailUpperBound+floatingPointAllowance,qualification:'analytical_tail_plus_binary64_engineering_allowance; not_formal_interval_certification'},
  actionable:false,calibration:'not_validated'});
}
