import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const target=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(target,'../../kampit');
const files=['app/KampitApp.tsx','app/globals.css','app/page.tsx','app/layout.tsx','app/api/kampit/route.ts','lib/catalog.ts','lib/types.ts','lib/server.ts','public/favicon.svg','vendor/shadcn-tailwind-4.13.0.css','vendor/shadcn-tailwind-4.13.0.LICENSE.md','postcss.config.mjs'];
const manifest={source:'../../kampit',contract:3,files:{}};
for(const name of files){
  let text=await readFile(path.join(source,name),'utf8');
  manifest.files[name]=createHash('sha256').update(text).digest('hex');
  if(name==='lib/server.ts'){
    text=text.replace("import { env } from 'cloudflare:workers';","import { database as postgresDatabase } from './database';\nimport type { D1Database, D1PreparedStatement } from './pg-adapter';\nimport { publicOrigin } from './public-origin';\nimport { resolveDatabaseUrl } from './deployment-env.mjs';")
      .replace("import { getChatGPTUser } from '../app/chatgpt-auth';","import { getVerifiedUser } from './auth';\nimport { resolveProfileId } from './identity';")
      .replace(/function database\(\):D1Database \{[^\n]+\}/,"function database():D1Database { try{resolveDatabaseUrl();}catch{throw new ApiError(503,'DATABASE_UNAVAILABLE','Kampit storage is not configured. Please try again shortly.');} return postgresDatabase(); }")
      .replace('await getChatGPTUser()','await getVerifiedUser()')
      .replace('const id=`user:${auth.userId}`;','const id=await resolveProfileId(auth.userId);')
      .replace("const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)","let expectedOrigin:string;try{expectedOrigin=publicOrigin(request);}catch{throw new ApiError(503,'SITE_UNAVAILABLE','Kampit site setup is incomplete. Please try again shortly.');} const origin=request.headers.get('origin');if(origin&&origin!==expectedOrigin)")
      .replace("new URL(request.url).protocol==='https:'","new URL(publicOrigin(request)).protocol==='https:'")
      .replaceAll('Sign in with ChatGPT','Sign in with email');
    if(text.includes('cloudflare:')||text.includes('getChatGPTUser'))throw Error('Unexpected core runtime dependency');
  }
  if(name==='app/KampitApp.tsx')text=text.replaceAll('/signin-with-chatgpt','/login').replaceAll('/signout-with-chatgpt','/logout').replaceAll('ChatGPT','email');
  await mkdir(path.dirname(path.join(target,name)),{recursive:true});
  await writeFile(path.join(target,name),text);
}
// Original deployed D1 migrations are read only. Build an isolated PG bootstrap.
const sqlite=await readFile(path.join(source,'drizzle/0000_youthful_jackal.sql'),'utf8');
const tables=[...sqlite.matchAll(/CREATE TABLE `([a-z_]+)` \([\s\S]*?\n\);/g)].map(m=>({name:m[1],sql:m[0].replaceAll('`','"'),refs:[...m[0].matchAll(/REFERENCES `([a-z_]+)`/g)].map(r=>r[1])}));
const ordered=[]; const pending=[...tables];
while(pending.length){const index=pending.findIndex(t=>t.refs.every(r=>ordered.some(t=>t.name===r)));if(index<0)throw Error('Unresolved schema dependencies');ordered.push(...pending.splice(index,1));}
const indexes=[...sqlite.matchAll(/CREATE (?:UNIQUE )?INDEX [\s\S]*?;/g)].map(m=>m[0].replaceAll('`','"'));
const alter=(await readFile(path.join(source,'drizzle/0001_milky_mongu.sql'),'utf8')).replaceAll('`','"').replaceAll('--> statement-breakpoint','\n');
const qualify=sql=>sql.replace(/(CREATE TABLE|REFERENCES|ALTER TABLE|ON) "([a-z_]+)"/g,'$1 kampit."$2"');
const pg=`-- Generated from immutable D1 schema; run once in a NEW target database.\nCREATE SCHEMA IF NOT EXISTS kampit;\nREVOKE ALL ON SCHEMA kampit FROM PUBLIC;\n${ordered.map(t=>qualify(t.sql)).join('\n')}\n${indexes.map(qualify).join('\n')}\n${qualify(alter)}\n`;
await writeFile(path.join(target,'sql/001-schema.sql'),pg);
await writeFile(path.join(target,'core-source.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Synced ${files.length} core files; generated ${tables.length} PostgreSQL tables. Native app unchanged.`);
