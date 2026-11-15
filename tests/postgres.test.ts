import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile,writeFile,unlink } from 'node:fs/promises';
import { D1Database,compileSql,type Driver,type Executor } from '../lib/pg-adapter';
import { sameOriginForm,safeReturnTo } from '../lib/auth-security';
import { publicOrigin } from '../lib/public-origin';
import { setDatabase,setUser } from './runtime-fixture';
import { getChallenge } from '../lib/catalog';
import postgres from 'postgres';
import { resolveDatabaseUrl,DatabaseConfigurationError } from '../lib/deployment-env.mjs';
const pg=new PGlite();
const trace:string[]=[];
let nativeSerializers:Record<number,(value:any)=>string>|undefined;
const executor=(connection:any):Executor=>({async query(sql,values=[]){trace.push(sql);const r=await connection.query(sql,values,{serializers:nativeSerializers});return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}});
const driver:Driver={...executor(pg),transaction:callback=>pg.transaction(tx=>callback(executor(tx)))};
const db=new D1Database(driver);setDatabase(db);
process.env.DATABASE_URL='postgresql://fixture:fixture@db.invalid:6543/fixture';
let passed=0;
function ok(name:string){passed++;console.log(`PASS ${passed}: ${name}`);}
const temporary=new URL('./.runtime-server.ts',import.meta.url);
try{
  // Only synthetic credentials; the driver is constructed lazily without opening a socket.
  const explicit='postgresql://postgres:test%40pass%2Fword%25%3F%23%20@db.example:5432/kampit?sslmode=require&application_name=Kampit%2BTest&options=-c%20statement_timeout%3D12000';
  const managed='postgres://postgres.fixture:fixture@aws-0-test.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.test&workaround=supabase-pooler.vercel';
  const expected='postgres://postgres.fixture:fixture@aws-0-test.pooler.supabase.com:6543/postgres?sslmode=require';
  assert.equal(resolveDatabaseUrl({DATABASE_URL:explicit,POSTGRES_URL:managed}),explicit);
  assert.equal(resolveDatabaseUrl({POSTGRES_URL:managed}),expected);
  assert.equal(resolveDatabaseUrl({DATABASE_URL:'  ',POSTGRES_URL:managed}),expected);
  assert.equal(resolveDatabaseUrl({DATABASE_URL:'  '+explicit+'  '}),explicit);
  assert.equal(resolveDatabaseUrl({DATABASE_URL:'postgres://user:pass@db.example/db'}),'postgres://user:pass@db.example/db');
  const anglePassword='postgresql://user:prefix%3Cabc%3Esuffix@db.example/db?sslmode=require';
  assert.equal(resolveDatabaseUrl({DATABASE_URL:anglePassword}),anglePassword);
  assert.equal(resolveDatabaseUrl({DATABASE_URL:'postgres://user:%3Cabc%3E@db.example/db'}),'postgres://user:%3Cabc%3E@db.example/db');
  assert.equal(resolveDatabaseUrl({POSTGRES_URL:managed+'&pgbouncer=true&connection_limit=1'}),expected+'&pgbouncer=true&connection_limit=1');
  assert.equal(resolveDatabaseUrl({DATABASE_URL:explicit+'&%73upa=provider&workaround=provider'}),explicit);
  for(const bad of ['', 'https://user:must-not-leak@db.example/db', 'not-a-url-must-not-leak', 'postgresql://user:bad%ZZ@db.example/db', 'postgresql://user:[YOUR-PASSWORD]@db.example/db', 'postgresql://user:must-not-leak@/db', 'postgresql://user:must-not-leak@db.example/db#fragment', '${POSTGRES_URL}']){
    assert.throws(()=>resolveDatabaseUrl({DATABASE_URL:bad}),error=>error instanceof DatabaseConfigurationError&&!String(error.stack).includes('must-not-leak')&&!('cause' in error));
  }
  assert.throws(()=>resolveDatabaseUrl({}),DatabaseConfigurationError);
  assert.throws(()=>resolveDatabaseUrl({DATABASE_URL:'https://invalid.example',POSTGRES_URL:managed}),DatabaseConfigurationError);
  const lazy=postgres(resolveDatabaseUrl({POSTGRES_URL:managed}),{max:1,prepare:false,ssl:'require'});
  assert.equal(lazy.options.max,1);assert.equal(lazy.options.prepare,false);assert.equal(lazy.options.ssl,'require');
  assert.ok(!('supa' in lazy.options.connection));assert.ok(!('workaround' in lazy.options.connection));
  await lazy.end();
  console.log('PASS native env: explicit priority, managed fallback, 8 invalid/missing cases, safe errors, metadata removal, intact TLS/options/password encoding and no metadata startup parameters.');
  // Use actual installed postgres.js codecs with real PG parameter description.
  // PGlite's default codec accepts a JSON string verbatim and hid this live bug.
  const {serializers}=await import(new URL('./types.js',import.meta.resolve('postgres')).href);
  nativeSerializers=serializers;
  const jsonText=JSON.stringify([{id:'first',score:42},{id:'second',score:17}]);
  const oldJsonSql='SELECT value FROM jsonb_array_elements($1::jsonb) AS input(value)';
  const fixedJsonSql=compileSql('SELECT value FROM json_each(?)');
  await pg.waitReady;
  assert.equal((await pg.describeQuery(oldJsonSql)).queryParams[0].dataTypeID,3802);
  await assert.rejects(pg.query(oldJsonSql,[jsonText],{serializers}),/cannot extract elements from a scalar/);
  const described=await pg.describeQuery(fixedJsonSql);
  assert.equal(described.queryParams[0].dataTypeID,25);
  const parsed=await pg.query<{value:{id:string;score:number}}>(fixedJsonSql,[jsonText],{serializers});
  assert.deepEqual(parsed.rows.map(r=>r.value),JSON.parse(jsonText));
  assert.deepEqual((await pg.query(fixedJsonSql,['[]'],{serializers})).rows,[]);
  await assert.rejects(pg.query(fixedJsonSql,['invalid-json'],{serializers}),/invalid input syntax for type json/);
  console.log('PASS native JSONB codec regression: old direct-jsonb binding reproduces live scalar failure; text-then-jsonb yields original array.');
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  for(const name of ['001-schema.sql','002-scoring-security.sql'])await pg.exec(await readFile(new URL(`../sql/${name}`,import.meta.url),'utf8'));
  const [{count}]= (await pg.query<{count:string}>('SELECT count(*) FROM pg_tables WHERE schemaname=\'kampit\' AND rowsecurity')).rows;
  assert.equal(Number(count),12);ok('PostgreSQL schema, indexes, scoring trigger and RLS installed');
  await pg.exec('SET ROLE anon');
  await assert.rejects(pg.query('SELECT * FROM kampit.profiles'),/permission denied/);await pg.exec('RESET ROLE');ok('Anonymous database role cannot read game tables');
  assert.equal(compileSql("SELECT '?' AS literal FROM profiles WHERE id=?"),"SELECT '?' AS literal FROM kampit.profiles WHERE id=$1");
  assert.equal(safeReturnTo('/?join=ABC123'),'/?join=ABC123');
  for(const unsafe of ['//evil.test','https://evil.test','/\\evil.test','/api/auth/signout','/login'])assert.equal(safeReturnTo(unsafe),'/');
  assert.throws(()=>sameOriginForm(new Request('http://localhost/api/auth/signin',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/x-www-form-urlencoded'}})));
  process.env.APP_ORIGIN='https://kampit.example';
  assert.equal(publicOrigin(new Request('http://0.0.0.0:3000/api/kampit',{headers:{host:'kampit.example','x-forwarded-host':'evil.test'}})),'https://kampit.example');
  assert.throws(()=>publicOrigin(new Request('http://0.0.0.0:3000/api/kampit',{headers:{host:'evil.test'}})));
  delete process.env.APP_ORIGIN;
  ok('SQL literal placeholders, safe invite return path and auth mutation origin checks');
  let core=await readFile(new URL('../lib/server.ts',import.meta.url),'utf8');
  core=core.replace("from './database'","from './runtime-fixture'").replace("from './auth'","from './runtime-fixture'").replace("from './identity'","from './runtime-fixture'").replace("from './catalog'","from '../lib/catalog'").replace("from './types'","from '../lib/types'").replace("from './pg-adapter'","from '../lib/pg-adapter'").replace("from './public-origin'","from '../lib/public-origin'").replace("from './deployment-env.mjs'","from '../lib/deployment-env.mjs'");
  await writeFile(temporary,core);
  const {handleGet,handlePost}=await import(temporary.href+'?version='+Date.now());
  let cookie='';
  const get=async(query='')=>{const response=await handleGet(new Request('http://localhost/api/kampit'+query,{headers:{cookie}}));return {status:response.status,body:await response.json()};};
  const post=async(action:string,payload:Record<string,unknown>={})=>{
    const response=await handlePost(new Request('http://localhost/api/kampit',{method:'POST',headers:{cookie,origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action,payload})}));
    const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
    return {status:response.status,body:await response.json()};
  };
  assert.equal((await get()).body.mode,'anonymous');
  const originalUrl=process.env.DATABASE_URL;delete process.env.DATABASE_URL;process.env.POSTGRES_URL=managed;
  assert.equal((await get()).body.mode,'anonymous'); // Native-only env also passes the generated backend guard.
  delete process.env.POSTGRES_URL;process.env.DATABASE_URL=originalUrl;
  assert.equal((await post('add-goal',{templateId:'spanish-daily',level:'light'})).status,401);ok('Guest state and unauthenticated write denial');
  const demo=await post('demo');assert.equal(demo.status,200,JSON.stringify(demo.body));assert.equal(demo.body.state.mode,'demo');
  assert.ok(demo.body.state.goals.length);assert.ok(demo.body.state.history.length);assert.ok(cookie.startsWith('kampit_demo='));
  ok('Real PostgreSQL demo seeding, bulk JSON inserts, rollover and history summary');
  const state=demo.body.state,goal=state.goals.find((g:any)=>g.verification==='quiz')||state.goals[0];
  let task=(await get('?goalId='+goal.id)).body;
  assert.ok(task.taskDate);assert.ok(!JSON.stringify(task).includes('"answer":'));
  const stale=await post('complete-goal',{goalId:goal.id,taskDate:'2000-01-01'});assert.equal(stale.status,409);assert.equal(stale.body.code,'TASK_EXPIRED');
  const wrong=Object.fromEntries((task.questions||[]).map((q:any)=>[q.id,0]));
  const full=getChallenge(goal.templateId,goal.level,task.taskDate);
  const answers=Object.fromEntries((full.questions||[]).map(q=>[q.id,q.answer]));
  if(task.questions?.length){wrong[task.questions[0].id]=(answers[task.questions[0].id]+1)%task.questions[0].options.length;const denied=await post('complete-goal',{goalId:goal.id,answers:wrong});assert.equal(denied.body.result.passed,false);}
  const completed=await post('complete-goal',{goalId:goal.id,taskDate:task.taskDate,answers});assert.equal(completed.status,200,JSON.stringify(completed.body));assert.ok(completed.body.result.passed);
  const repeated=await post('complete-goal',{goalId:goal.id,answers});assert.equal(repeated.status,409);
  assert.ok(trace.some(s=>s.endsWith('ORDER BY id FOR UPDATE')));ok('Answer redaction, wrong quiz, stale task, valid award, duplicate credit and explicit pre-insert row lock');
  const week=state.history[0];const detail=await get('?historyWeek='+week.id);assert.equal(detail.status,200);assert.ok(detail.body.activities.length);assert.ok(detail.body.activities.every((a:any)=>a.prompt));
  const writer=state.goals.find((g:any)=>g.verification==='writing');
  assert.ok(writer);const short=await post('complete-goal',{goalId:writer.id,text:'Too short'});assert.equal(short.status,400);
  const validText='Learning grows through deliberate daily practice. I choose a realistic task, describe a specific example, reflect on what changed, and apply one useful improvement tomorrow. This saved paragraph demonstrates a personal writing activity rather than independent verification of quality. '.repeat(6);
  const written=await post('complete-goal',{goalId:writer.id,text:validText});assert.equal(written.status,200,JSON.stringify(written.body));ok('Own completed-week detail and writing validation persisted in PostgreSQL');
  const remaining=written.body.state.goals.find((g:any)=>!g.completedToday);
  if(remaining){const remainingTask=(await get('?goalId='+remaining.id)).body;const challenge=getChallenge(remaining.templateId,remaining.level,remainingTask.taskDate);const solved=Object.fromEntries((challenge.questions||[]).map(q=>[q.id,q.answer]));const finished=await post('complete-goal',{goalId:remaining.id,taskDate:remainingTask.taskDate,answers:solved});assert.equal(finished.status,200);assert.equal(finished.body.state.today.planComplete,true);assert.equal(finished.body.state.today.completedPlannedCount,finished.body.state.today.plannedCount);assert.ok(finished.body.state.today.score<=100);}
  ok('Personal plan completion is independent of the ranking cap');
  const scheduled=await post('schedule-level',{goalId:goal.id,level:goal.level==='light'?'stretch':'light'});assert.equal(scheduled.status,200);const scheduledGoal=scheduled.body.state.goals.find((g:any)=>g.id===goal.id);assert.equal(scheduledGoal.level,goal.level);assert.ok(scheduledGoal.nextLevelStartsAt);
  assert.equal((await post('schedule-level',{goalId:goal.id,level:goal.level})).body.state.goals.find((g:any)=>g.id===goal.id).nextLevel,null);ok('Next-week scheduling and cancellation leave current level intact');
  const firstId=state.viewer.id;const switched=await post('switch-demo');assert.equal(switched.status,200);assert.notEqual(switched.body.state.viewer.id,firstId);
  assert.equal((await get('?goalId='+goal.id)).status,404);
  assert.equal((await post('archive-goal',{goalId:goal.id})).status,404);ok('Separate demo participants, goal ownership and private history boundaries');
  await post('leave-demo');assert.equal((await get()).body.mode,'anonymous');cookie='';setUser('alice');
  const account=await get();assert.equal(account.body.viewer.id,'supabase:alice');assert.equal(account.body.goals.length,0);assert.equal(account.body.history.length,0);
  assert.equal((await post('onboard',{name:'Alice',interests:[],timezone:'America/New_York'})).status,400);
  assert.equal((await post('onboard',{name:'Alice',interests:['Writing'],timezone:'Bad/Zone'})).status,400);
  assert.equal((await post('onboard',{name:'Alice',interests:['Writing'],timezone:'America/New_York'})).status,200);ok('Account/demo isolation and onboarding input validation (verified identity simulated only)');
  const friends=await post('create-group',{name:'My friends'});assert.equal(friends.status,200);const invite=friends.body.result.code;
  const privateId=friends.body.state.competitions.find((c:any)=>c.kind==='friends').id;
  const global=friends.body.state.competitions.find((c:any)=>c.kind==='global');
  assert.equal((await post('join-competition',{competitionId:global.id})).status,403);
  setUser('bob');assert.equal((await get('?competitionId='+privateId)).status,403);
  assert.equal((await post('join-group',{code:invite})).status,200);ok('Private invite joins, hidden group denial and server Prime gate');
  const bobGoal=await post('add-goal',{templateId:'javascript-daily',level:'light'});const bg=bobGoal.body.state.goals[0];
  await post('schedule-level',{goalId:bg.id,level:'stretch'});
  await db.prepare('UPDATE goals SET next_level_starts_at=? WHERE id=?').bind('2000-01-01T00:00:00Z',bg.id).run();
  const applied=(await get()).body.goals.find((g:any)=>g.id===bg.id);assert.equal(applied.level,'stretch');assert.equal(applied.nextLevel,null);ok('Due scheduled level applies before automatic new-week lock');
  setUser('alice');assert.equal((await post('prime-demo',{enabled:true})).status,200);assert.equal((await post('join-competition',{competitionId:global.id})).status,200);assert.equal((await post('prime-demo',{enabled:false})).status,200);ok('Explicit no-charge Prime entitlement and revocation');
  const created=await post('add-goal',{templateId:'spanish-daily',level:'stretch'});assert.equal(created.status,200);const own=created.body.state.goals[0];
  assert.equal((await post('add-goal',{templateId:'spanish-daily',level:'stretch'})).status,409);
  assert.equal((await post('archive-goal',{goalId:own.id})).status,200);assert.equal((await post('add-goal',{templateId:'spanish-daily',level:'light'})).status,409);ok('Active goal uniqueness and locked difficulty after archive');
  // Real trigger stress: several >cap checkins in one transaction, then more queued writes.
  await db.prepare("INSERT INTO goals(id,user_id,template_id,level,archived,created_at) VALUES (?,?,?,?,0,?)").bind('cap-goal','supabase:alice','cap-test','stretch',new Date().toISOString()).run();
  const insert=(id:string,template:string,day:string,base:number)=>db.prepare('INSERT OR IGNORE INTO daily_checkins(id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,'supabase:alice','cap-goal',template,day,state.week.id,base,'self','',new Date().toISOString());
  await insert('cap-yesterday','yesterday','2026-01-01',60).run();
  const capWrites=Array.from({length:10},(_,i)=>insert('cap-'+i,'cap-'+i,'2026-01-02',35));
  await db.batch(capWrites.slice(0,5));await Promise.all(capWrites.slice(5).map(s=>s.run()));
  const cap=await db.prepare('SELECT SUM(points) AS score,SUM(streak_bonus) AS bonus FROM score_events WHERE user_id=? AND local_date=?').bind('supabase:alice','2026-01-02').first<any>();
  assert.equal(Number(cap.score),100);assert.equal(Number(cap.bonus),5);assert.equal((await insert('duplicate-cap','cap-0','2026-01-02',35).run()).meta.changes,0);ok('Trigger caps 10 awards at 100, one streak bonus, duplicate ignored (PGlite serializes sessions)');
  await assert.rejects(pg.query("INSERT INTO kampit.daily_checkins(id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,evidence,created_at) VALUES('bypass','supabase:alice','cap-goal','bypass','2026-01-03','test',30,'self','','test')"),/lock profile BEFORE INSERT/);ok('Unwrapped scoring SQL rejected by trigger');
  await assert.rejects(db.batch([db.prepare("UPDATE profiles SET name=? WHERE id=?").bind('Should roll back','supabase:alice'),db.prepare('INSERT INTO goals(id) VALUES(?)').bind('invalid')]));
  assert.equal((await db.prepare('SELECT name FROM profiles WHERE id=?').bind('supabase:alice').first<any>()).name,'Alice');ok('Atomic batch rollback on dependent database failure');
  // Ten real persisted same-tier peers; top three tie across a 2-slot quota.
  const tieId='tie-fixture',oldWeek=state.history[0].id,start=oldWeek.slice(5);
  await db.prepare("INSERT INTO competitions(id,workspace,name,description,kind,creator_id,created_at) VALUES(?,'live','Tie fixture','Test','friends',?,?)").bind(tieId,'supabase:alice','2000').run();
  for(let i=0;i<10;i++){
    const userId=i===0?'supabase:alice':`test-peer-${i}`,gId=`tie-goal-${i}`;
    if(i>0)await db.prepare("INSERT INTO profiles(id,workspace,name,created_at) VALUES(?,'live',?,?)").bind(userId,`Peer ${i}`,'2000').run();
    await db.prepare("INSERT INTO goals(id,user_id,template_id,level,created_at) VALUES(?,?,'tie-practice','light','2000')").bind(gId,userId).run();
    await db.prepare("INSERT INTO competition_members(id,competition_id,user_id,created_at) VALUES(?,?,?,'2000')").bind(`tie-member-${i}`,tieId,userId).run();
    await db.prepare("INSERT INTO rank_records(id,user_id,scope_id,tier,last_season,updated_at) VALUES(?,?,?,'Silver',?,'2000')").bind(`tie-rank-${i}`,userId,`friends:${tieId}`,oldWeek).run();
    for(let day=0;day<5;day++){
      const d=new Date(`${start}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+day);
      await db.prepare("INSERT INTO daily_checkins(id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,created_at) VALUES(?,?,?,?,?,?,?,'self','2000')").bind(`tie-checkin-${i}-${day}`,userId,gId,'tie-practice',d.toISOString().slice(0,10),oldWeek,i<3?80:70-i*5).run();
    }
  }
  const ties=await get('?competitionId='+tieId);assert.equal(ties.status,200,JSON.stringify(ties.body));
  const moved=await db.prepare('SELECT user_id,tier FROM rank_records WHERE scope_id=? ORDER BY user_id').bind(`friends:${tieId}`).all<any>();
  for(const id of ['supabase:alice','test-peer-1','test-peer-2'])assert.equal(moved.results.find((r:any)=>r.user_id===id).tier,'Silver');
  const tiedHistory=await db.prepare('SELECT reason,position FROM rank_history WHERE user_id=? AND scope_id=?').bind('supabase:alice',`friends:${tieId}`).first<any>();assert.match(tiedHistory.reason,/tied score group crossed/);assert.equal(tiedHistory.position,1);
  ok('Ten-peer rank rollover holds a tied group crossing quota and stores exact reason/placement');
  const cross=await handlePost(new Request('http://localhost/api/kampit',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{"action":"demo"}'}));assert.equal(cross.status,403);
  const malformed=await handlePost(new Request('http://localhost/api/kampit',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'oops'}));assert.equal(malformed.status,400);ok('Cross-origin and malformed JSON mutation denial');
  const unavailable:Driver={async query(){throw Error('Simulated dependent database failure');},async transaction(){throw Error('Simulated dependent database failure');}};
  setDatabase(new D1Database(unavailable));const down=await get();assert.equal(down.status,500);assert.equal(down.body.code,'INTERNAL_ERROR');setDatabase(db);ok('Dependent storage failure returns an honest error, without synthetic state');
  console.log(`PASS: ${passed} PostgreSQL workflow groups. Supabase live authentication and multi-connection PostgreSQL concurrency are NOT tested.`);
}finally{await unlink(temporary).catch(()=>{});await pg.close();}
