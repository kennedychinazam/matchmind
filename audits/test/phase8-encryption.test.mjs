import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,privateDecrypt,constants,createDecipheriv}from 'node:crypto';
const api=await import('../phase8/seal-results.mjs').catch(()=>({}));
test('public CI retention can carry only authenticated ciphertext; private recipient key stays outside runner',()=>{
 assert.equal(typeof api.sealResults,'function');const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
 const raw=Buffer.from('private prediction and budget backup'),sealed=api.sealResults(raw,publicKey);
 assert.equal(JSON.stringify(sealed).includes(raw.toString()),false);
 const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(sealed.wrapped_key,'base64'));
 const decrypt=v=>{const d=createDecipheriv('aes-256-gcm',key,Buffer.from(v.iv,'base64'));d.setAAD(Buffer.from(v.aad));d.setAuthTag(Buffer.from(v.tag,'base64'));return Buffer.concat([d.update(Buffer.from(v.ciphertext,'base64')),d.final()]);};
 assert.equal(decrypt(sealed).toString(),raw.toString());assert.throws(()=>decrypt({...sealed,aad:sealed.aad+'changed'}));
 assert.notEqual(api.sealResults(raw,publicKey).ciphertext,sealed.ciphertext);
 assert.throws(()=>api.sealResults(raw,generateKeyPairSync('rsa',{modulusLength:1024}).publicKey),/recipient/);
});
