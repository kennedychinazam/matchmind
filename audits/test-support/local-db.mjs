import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout} from 'node:timers/promises';
export const IMAGE='postgres:17-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27';
const env={...process.env};
for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[k];
export function docker(args,input) { return execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:64*1024*1024}); }
export function localDatabase(label) {
 const name=`mm-phase3-${process.pid}-${label}`;
 let started=false;
 const sql=(text,db='matchmind_test')=>docker(['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',db,'-At'],text).trim();
 return {name,sql,
  apply(file){ return sql(readFileSync(new URL('../staging/'+file,import.meta.url),'utf8')); },
  async start() {
   docker(['run','--detach','--rm','--name',name,'--network','none','--label','matchmind.phase3.synthetic=true','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=matchmind_test',IMAGE]); started=true;
   for(let i=0;i<100;i++){try{if(sql('select 1')==='1') return;}catch{}await setTimeout(100);}
   throw Error('local PostgreSQL startup failed');
  },
  close(){if(started){docker(['rm','--force',name]);started=false;}},
  dump(){return docker(['exec',name,'pg_dump','-U','postgres','-d','matchmind_test']);},
  restore(dump){sql('create database matchmind_restore');return sql(dump,'matchmind_restore');}
 };
}
export function literal(value) {return "'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";}
