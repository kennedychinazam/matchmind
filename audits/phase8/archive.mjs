import {readFileSync}from 'node:fs';import {join}from 'node:path';import {createHash}from 'node:crypto';
export function loadBackup(directory,backupName,hashName){
 for(const name of [backupName,hashName])if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))throw Error('explicit backup basename required');
 const dump=readFileSync(join(directory,backupName),'utf8'),expected=readFileSync(join(directory,hashName),'utf8').trim();
 if(createHash('sha256').update(dump).digest('hex')!==expected)throw Error('private backup hash mismatch');return dump;
}
