import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { resolveDatabaseUrl } from '../lib/deployment-env.mjs';
const sql=postgres(resolveDatabaseUrl(),{max:1,prepare:false,ssl:'require',onnotice:()=>{}});
try{
  await sql.begin(async tx=>{
    await tx.unsafe("SELECT pg_advisory_xact_lock(73189,3001)");
    const found=await tx.unsafe("SELECT to_regclass('kampit.profiles') AS existing");
    if(found[0].existing)throw Error('Kampit schema already exists. Bootstrap intentionally refuses to overwrite data.');
    for(const name of ['001-schema.sql','002-scoring-security.sql'])await tx.unsafe(await readFile(new URL(`../sql/${name}`,import.meta.url),'utf8'));
  });
  console.log('Kampit PostgreSQL schema installed; RLS enabled, browser roles revoked.');
}finally{await sql.end();}
