import test from 'node:test';
import assert from 'node:assert/strict';
import {input,signed} from '../test-support/a4/synthetic.mjs';
import {verifyBundle} from '../a4/provenance.mjs';
import {buildEvidencePacket} from '../a4/evidence.mjs';

// Exercise the full signed-source capability -> packet path. A synthetic
// signature binds the supplied name; it does not establish real identity.
function capability(field,value){
 const i=input();i.fixture[field]=value;
 const s=signed(i),cap=verifyBundle(s.bundle,s.options);
 assert.equal(cap.classification,'synthetically_verified');
 return cap;
}
const fields=['home','away','competition','country','venue'];
const contaminated=['Odds BK at 1.90','Odds BK @ 1.90','Odds BK (2.50)','Odds BK 5/2','Odds BK price 2.50'];
for(const field of fields)for(const value of contaminated){
 test(`signed source cannot admit price-like ${field} identity: ${value}`,()=>{
  const cap=capability(field,value);
  assert.throws(()=>buildEvidencePacket(cap),/identity_label_price_or_fraction|prohibited_football_instruction_or_data/);
 });
}
for(const value of ['Odds BK2.50','Odds BK(1.90)','Odds BK (2,50)','Odds BK 5 / 2','Odds BK 1000/1','Odds BK 5/2026','Odds BK 2026/1']){
 test(`annotation boundaries do not hide identity prices: ${value}`,()=>{
  assert.throws(()=>buildEvidencePacket(capability('home',value)),/identity_label_price_or_fraction/);
 });
}
const ordinary={
 home:['Odds BK','Roi Et United','Engineers FC','Real Betis','1. FC Köln','1860 Munich','FC 08 Homburg'],
 away:['Odds BK','Roi Et United','Engineers FC','Real Betis','1. FC Köln','1860 Munich'],
 competition:['Ligue 1','1. Liga','2. Bundesliga','Premier League 2026/27','League 2026/2027','UEFA U21 Championship','Division 2 (Group 1)'],
 country:['Norway','Côte d’Ivoire','Timor-Leste','Congo (DR)'],
 venue:['Stadium 974','Stade du 5 Juillet 1962','Stadion an der Alten Försterei','Arena (Pitch 2)']
};
for(const[field,values]of Object.entries(ordinary))for(const value of values){
 test(`signed synthetic name preserves football ${field} naming: ${value}`,()=>{
  const p=buildEvidencePacket(capability(field,value));
  assert.equal(p.fixture[field],value);
  assert.equal(p.provenance.classification,'synthetically_verified');
  assert.equal(p.provenance.certified_prospective,false);
 });
}
for(const field of fields)for(const value of ['Odds BK at 1%2e90','Odds BK (2&#46;50)','Odds BK 5\\u002f2']){
 test(`encoded ${field} price does not evade identity admission: ${value}`,()=>{
  assert.throws(()=>buildEvidencePacket(capability(field,value)),/prohibited_or_ambiguous_football_text/);
 });
}
test('a correctly signed contaminated identity cannot acquire genuine source authority',()=>{
 const i=input();i.fixture.home='Odds BK at 1.90';const s=signed(i);
 assert.throws(()=>verifyBundle(s.bundle,{...s.options,mode:'prospective'}),/real_source_authority_unconfigured/);
});
test('compatibility-form identity ambiguity stays blocked without rewriting the source name',()=>{
 assert.throws(()=>buildEvidencePacket(capability('home','1º de Agosto')),/prohibited_or_ambiguous_football_text/);
});
