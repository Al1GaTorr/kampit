import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { resolveDatabaseUrl } from '../lib/deployment-env.mjs';
const filename=process.argv[2];
if(!filename)throw Error('Usage: npm run data:link -- /private/verified-mapping.json');
const mapping=JSON.parse(await readFile(filename,'utf8'));
if(!/^[a-f0-9-]{36}$/i.test(mapping.supabaseUserId)||!/^user:.{1,200}$/.test(mapping.legacyProfileId)||typeof mapping.verificationNote!=='string'||mapping.verificationNote.trim().length<20)throw Error('Provide a verified UUID, legacy user: profile and specific verification note.');
const sql=postgres(resolveDatabaseUrl(),{max:1,prepare:false,ssl:'require',onnotice:()=>{}});
try{
  await sql.begin(async tx=>{
    const [auth]=await tx.unsafe('SELECT id FROM auth.users WHERE id=$1::uuid AND email_confirmed_at IS NOT NULL',[mapping.supabaseUserId]);
    if(!auth)throw Error('Target Supabase Auth account must exist and have confirmed email.');
    const [legacy]=await tx.unsafe("SELECT id FROM kampit.profiles WHERE id=$1 AND workspace='live' FOR UPDATE",[mapping.legacyProfileId]);
    if(!legacy)throw Error('Legacy live account not found.');
    const [newer]=await tx.unsafe('SELECT id FROM kampit.profiles WHERE id=$1',[`supabase:${mapping.supabaseUserId}`]);
    if(newer)throw Error('Target already has Kampit data. Manual reviewed reconciliation required; no silent merge.');
    await tx.unsafe('INSERT INTO kampit.identity_links(supabase_user_id,profile_id,verified_at,verification_note) VALUES($1,$2,now(),$3)',[mapping.supabaseUserId,mapping.legacyProfileId,mapping.verificationNote.trim()]);
  });
  console.log('Verified legacy identity link stored; legacy IDs and references unchanged.');
}finally{await sql.end();}
