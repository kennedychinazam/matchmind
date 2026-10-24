// Offline proof reproduction. Trust policy is a separate, independently supplied file.
import {readFileSync}from 'node:fs';
import {join}from 'node:path';
import {fitCoefficient}from './train.mjs';
import {validateCoefficient}from './evaluate.mjs';
const directory=process.argv[2],policyFile=process.argv[3];if(!directory||!policyFile||process.argv.length!==4)throw Error('usage: node audits/phase7/reproduce.mjs /private/frozen-proof-directory /independently-supplied/policy.json');
const read=n=>JSON.parse(readFileSync(join(directory,n),'utf8'));
const training=read('training.json'),policy=JSON.parse(readFileSync(policyFile,'utf8')),original=read('artifact.json'),artifact=fitCoefficient(training,policy,original.configuration);
if(artifact.artifact_hash!==original.artifact_hash)throw Error('artifact does not reproduce');
const validation=validateCoefficient(artifact,read('freeze.json'),read('validation.json'),policy,read('protocol.json'));
process.stdout.write(JSON.stringify({artifact,validation},null,2)+'\n');
