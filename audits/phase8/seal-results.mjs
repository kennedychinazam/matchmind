// Authenticated envelope for a future owner-approved CI export. Never stores a
// recipient private key; passing a public key is insufficient to activate CI.
import {randomBytes,createCipheriv,publicEncrypt,createPublicKey,constants,KeyObject,createHash}from 'node:crypto';
import {readFileSync,writeFileSync}from 'node:fs';
import {pathToFileURL}from 'node:url';
export function sealResults(bytes,recipientPublicKey){
 const recipient=recipientPublicKey instanceof KeyObject?recipientPublicKey:createPublicKey(recipientPublicKey);
 if(recipient.type!=='public'||recipient.asymmetricKeyType!=='rsa'||recipient.asymmetricKeyDetails.modulusLength<3072)throw Error('recipient RSA public key of at least3072bits required');
 const key=randomBytes(32),iv=randomBytes(12),aad='matchmind-private-weekend:envelope-v1';
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
 const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
 const wrapped=publicEncrypt({key:recipient,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key);key.fill(0);
 return{version:1,algorithm:'RSA-OAEP-SHA256+AES-256-GCM',aad,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),wrapped_key:wrapped.toString('base64'),ciphertext:ciphertext.toString('base64'),ciphertext_sha256:createHash('sha256').update(ciphertext).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==5)throw Error('usage: node audits/phase8/seal-results.mjs /private/input.tar /private/encrypted.json /owner/public-key.pem');
 writeFileSync(process.argv[3],JSON.stringify(sealResults(readFileSync(process.argv[2]),readFileSync(process.argv[4]))),{mode:0o600,flag:'wx'});
}
