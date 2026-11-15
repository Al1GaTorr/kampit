// Destructive only to its own random fixture. Run against a dedicated TEST database.
import postgres from 'postgres';
import assert from 'node:assert/strict';
import { resolveDatabaseUrl } from '../lib/deployment-env.mjs';
if(process.env.KAMPIT_ALLOW_INTEGRATION_TESTS!=='1')throw Error('Use a dedicated migrated test database and explicitly set KAMPIT_ALLOW_INTEGRATION_TESTS=1.');
const databaseUrl=resolveDatabaseUrl();
const clients=[0,1].map(()=>postgres(databaseUrl,{max:1,prepare:false,ssl:'require',onnotice:()=>{}}));
const id='demo:concurrency:'+crypto.randomUUID(),goal=crypto.randomUUID(),date='2026-01-01',stamp=new Date().toISOString();
try{
  await clients[0].begin(async tx=>{
    await tx.unsafe("INSERT INTO kampit.profiles(id,workspace,name,created_at) VALUES($1,$2,'Concurrency test fixture',$3)",[id,id,stamp]);
    await tx.unsafe("INSERT INTO kampit.goals(id,user_id,template_id,level,created_at) VALUES($1,$2,'test','light',$3)",[goal,id,stamp]);
  });
  let firstLocked;const locked=new Promise(resolve=>firstLocked=resolve);
  const first=clients[0].begin(async tx=>{
    await tx.unsafe('SELECT id FROM kampit.profiles WHERE id=$1 FOR UPDATE',[id]);
    firstLocked();await tx.unsafe('SELECT pg_sleep(0.25)');
    await tx.unsafe("SELECT set_config('kampit.scoring_lock','held',true)");
    await tx.unsafe("INSERT INTO kampit.daily_checkins(id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,created_at) VALUES($1,$2,$3,'first',$4,'test',70,'self',$5)",[crypto.randomUUID(),id,goal,date,stamp]);
  });
  await locked;
  const second=clients[1].begin(async tx=>{
    await tx.unsafe('SELECT id FROM kampit.profiles WHERE id=$1 FOR UPDATE',[id]);
    await tx.unsafe("SELECT set_config('kampit.scoring_lock','held',true)");
    await tx.unsafe("INSERT INTO kampit.daily_checkins(id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,created_at) VALUES($1,$2,$3,'second',$4,'test',70,'self',$5)",[crypto.randomUUID(),id,goal,date,stamp]);
  });
  await Promise.all([first,second]);
  const rows=await clients[0].unsafe('SELECT points FROM kampit.score_events WHERE user_id=$1 ORDER BY points DESC',[id]);
  assert.deepEqual(rows.map(r=>r.points),[70,30]);console.log('PASS: two independent PostgreSQL sessions awarded 70 + 30, total 100.');
}finally{
  await clients[0].begin(async tx=>{
    for(const table of ['score_events','daily_checkins','goals'])await tx.unsafe(`DELETE FROM kampit.${table} WHERE user_id=$1`,[id]);
    await tx.unsafe('DELETE FROM kampit.profiles WHERE id=$1',[id]);
  }).catch(()=>{});
  await Promise.all(clients.map(c=>c.end()));
}
