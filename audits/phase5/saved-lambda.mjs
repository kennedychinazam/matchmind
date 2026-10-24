// Conditional diagnostic using the actual source method, without loading the app.
// Rounded saved lambdas cannot recreate historical input features/model versions.
import vm from 'node:vm';
import { createHash } from 'node:crypto';
export function loadSavedLambdaGrid(appSource) {
  const source = appSource.replaceAll('\r\n','\n');
  const tune = source.match(/const TUNE\s*=\s*\{[^;]+;/)?.[0];
  const engine = source.match(/const ENGINE2 = \{[\s\S]*?\n\};/)?.[0];
  const poisson = source.match(/function poissonPMF\(lambda, k\)\{[\s\S]*?\n\}/)?.[0];
  const start = source.indexOf('  marketsFor(lambdaH, lambdaA, rates, rhoOverride){');
  const end = source.indexOf('\n  /* BUILD 150', start);
  if (!tune || !engine || !poisson || start<0 || end<0) throw new Error('source contract changed');
  const method = source.slice(start,end);
  const code = `${tune}\n${engine}\n${poisson}\nconst grid={${method}};\n`;
  const context = vm.createContext({});
  vm.runInContext(code,context,{timeout:1000});
  return { source_sha256:createHash('sha256').update(code).digest('hex'),
    predict(h,a,rho) {
      if (![h,a,rho].every(x=>typeof x==='number' && Number.isFinite(x)) || h<=0 || a<=0 || h>10 || a>10 || Math.abs(rho)>1) throw new Error('invalid lambda or rho');
      context.h=h; context.a=a; context.rho=rho;
      return Array.from(vm.runInContext('(()=>{const p=grid.marketsFor(h,a,null,rho);return [p.pW,p.pD,p.pL]})()',context,{timeout:1000}));
    } };
}
