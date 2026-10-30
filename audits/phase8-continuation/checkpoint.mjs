import {readFileSync,readdirSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';import {createHash} from 'node:crypto';
import {privateDirectory} from '../phase8/files.mjs';import {loadBackup} from '../phase8/archive.mjs';
import {verifyAncestry} from './recovery.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
function durableWrite(path,content){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,content);fsyncSync(fd);}finally{closeSync(fd);}}
export function checkpointWriter(db,store,directory,parentSha){
 if(!/^[a-f0-9]{64}$/.test(parentSha))throw Error('verified parent SHA256 required');
 const dir=privateDirectory(directory);if(readdirSync(dir).length)throw Error('empty checkpoint directory required; never silently reset existing journal');
 let number=0,parent=parentSha;
 return()=>{
  const stem='checkpoint-'+String(++number).padStart(6,'0'),backup=stem+'.sql',dump=db.dump(),sha=hash(dump);
  const meta={version:'private-checkpoint-v1',backup,checksum:stem+'.sha256',backup_sha256:sha,parent_sha256:parent,created_at_utc:new Date().toISOString(),reserved_micros:store.reservedMicros(),events:store.events().map(e=>({event_id:e.event_id,kind:e.kind,parent:e.parent_id??null,hash:e.event_body_hash,received:e.received_at}))};
  durableWrite(join(dir,backup),dump);durableWrite(join(dir,meta.checksum),sha+'\n');durableWrite(join(dir,stem+'.json'),JSON.stringify(meta)+'\n');
  const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}parent=sha;return meta;
 };
}
export function verifyCheckpointFiles(directory,parentSha){
 const dir=privateDirectory(directory),all=readdirSync(dir),names=all.filter(n=>/^checkpoint-\d{6}\.json$/.test(n)).sort();
 if(!names.length||all.length!==names.length*3)throw Error('incomplete private checkpoint files');
 const checkpoints=[];let parent=parentSha;
 for(let i=0;i<names.length;i++){
  const stem='checkpoint-'+String(i+1).padStart(6,'0');if(names[i]!==stem+'.json')throw Error('missing checkpoint generation');
  const m=JSON.parse(readFileSync(join(dir,names[i]),'utf8'));
  if(m.parent_sha256!==parent||m.backup!==stem+'.sql'||m.checksum!==stem+'.sha256')throw Error('broken checkpoint parent continuity');
  const dump=loadBackup(dir,m.backup,m.checksum);if(hash(dump)!==m.backup_sha256)throw Error('checkpoint backup checksum mismatch');
  checkpoints.push(m);parent=m.backup_sha256;
 }
 verifyAncestry(checkpoints.map(m=>({events:m.events,liability_micros:m.reserved_micros})));
 // File proof alone does NOT authorize cold resume. Restore actual SQL and compare
 // all event hashes/receipts against the verified parent before accepting this head.
 return checkpoints;
}
