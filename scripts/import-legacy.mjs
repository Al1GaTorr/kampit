import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolveDatabaseUrl } from '../lib/deployment-env.mjs';
const filename=process.argv[2];
if(!filename)throw Error('Usage: npm run data:import -- /private/export.json; DATABASE_URL or POSTGRES_URL required.');
const raw=await readFile(filename);if(raw.length>128*1024*1024)throw Error('Export exceeds bounded import limit; split with a reviewed migration.');
const payload=JSON.parse(raw.toString());
const order=['profiles','demo_sessions','seasons','goals','template_locks','competitions','competition_members','daily_checkins','score_events','rank_records','rank_history'];
if(payload.format!=='kampit-legacy-export-v1'||!payload.tables||Object.keys(payload.tables).sort().join()!==[...order].sort().join())throw Error('Invalid export shape.');
for(const name of order)if(!Array.isArray(payload.tables[name])||payload.tables[name].length>500000)throw Error('Invalid or oversized export table.');
const sql=postgres(resolveDatabaseUrl(),{max:1,prepare:false,ssl:'require',onnotice:()=>{}});
try{
  await sql.begin(async tx=>{
    await tx.unsafe('LOCK TABLE '+order.map(n=>`kampit.${n}`).join(',')+' IN ACCESS EXCLUSIVE MODE');
    for(const name of order){
      const [{count}]=await tx.unsafe(`SELECT count(*) FROM kampit.${name}`);
      if(Number(count)!==0)throw Error('Target must be empty; refusing merge or overwrite.');
    }
    // Existing historical awards are imported exactly, never recomputed by a new trigger.
    await tx.unsafe('ALTER TABLE kampit.daily_checkins DISABLE TRIGGER checkins_award_points');
    for(const name of order){
      const columns=await tx.unsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['kampit',name]);
      const allow=new Set(columns.map(c=>c.column_name));
      for(const row of payload.tables[name]){
        if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid row');
        const keys=Object.keys(row);if(!keys.length||keys.some(k=>!allow.has(k)))throw Error('Unexpected legacy column');
        await tx.unsafe(`INSERT INTO kampit.${name} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
      }
      const [{count}]=await tx.unsafe(`SELECT count(*) FROM kampit.${name}`);
      if(Number(count)!==payload.tables[name].length)throw Error('Import count mismatch');
    }
    await tx.unsafe('ALTER TABLE kampit.daily_checkins ENABLE TRIGGER checkins_award_points');
  });
  console.log(JSON.stringify({status:'imported',sha256:createHash('sha256').update(raw).digest('hex'),counts:Object.fromEntries(order.map(n=>[n,payload.tables[n].length])),identity:'Legacy IDs retained. No accounts auto-linked.'}));
}finally{await sql.end();}
