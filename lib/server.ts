import { database as postgresDatabase } from './database';
import type { D1Database, D1PreparedStatement } from './pg-adapter';
import { publicOrigin } from './public-origin';
import { resolveDatabaseUrl } from './deployment-env.mjs';
import { getVerifiedUser } from './auth';
import { resolveProfileId } from './identity';
import { TEMPLATES, getChallenge } from './catalog';
import type { AppState, ApiResponse, CompetitionView, GoalTemplate, GoalView, LeaderboardEntry, Level, Profile, TaskChallenge, Tier, WeeklySummary, WeekDetail, PracticeRecord } from './types';

type Row = Record<string, any>;
type Actor = { id:string; workspace:string; mode:'account'|'demo'; session?:Row };
const TIERS:Tier[]=['Bronze','Silver','Gold','Platinum','Diamond'];
const COOKIE='kampit_demo';
const DAILY_CAP=100;
const SEASON_ZONE='America/New_York';
class ApiError extends Error { constructor(public status:number, public code:string, message:string) { super(message); } }
function database():D1Database { try{resolveDatabaseUrl();}catch{throw new ApiError(503,'DATABASE_UNAVAILABLE','Kampit storage is not configured. Please try again shortly.');} return postgresDatabase(); }
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
async function one(sql:string,...values:unknown[]):Promise<Row|null> { return database().prepare(sql).bind(...values).first<Row>(); }
async function rows(sql:string,...values:unknown[]):Promise<Row[]> { return (await database().prepare(sql).bind(...values).all<Row>()).results; }
async function run(sql:string,...values:unknown[]) { return database().prepare(sql).bind(...values).run(); }
function cookieValue(request:Request):string|null { const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1); return value && /^[a-f0-9-]{72,80}$/i.test(value)?value:null; }
function cookieHeader(request:Request,token:string,maxAge=60*60*24*14) { return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(publicOrigin(request)).protocol==='https:'?'; Secure':''}`; }
function validZone(value:unknown):string { const zone=typeof value==='string'?value:'America/New_York'; try { new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(); return zone; } catch { throw new ApiError(400,'INVALID_TIMEZONE','Choose a valid time zone.'); } }
function localDate(date:Date,timeZone:string):string { const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const p=(key:string)=>parts.find(v=>v.type===key)?.value; return `${p('year')}-${p('month')}-${p('day')}`; }
function shiftDate(date:string,days:number):string { const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
function midnightInZone(date:string,timeZone:string):Date {
  const [y,m,d]=date.split('-').map(Number); const desired=Date.UTC(y,m-1,d); let stamp=desired;
  for(let i=0;i<3;i++){ const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)); const p=(k:string)=>Number(parts.find(v=>v.type===k)?.value||0); const viewed=Date.UTC(p('year'),p('month')-1,p('day'),p('hour'),p('minute'),p('second'));stamp+=desired-viewed; }
  return new Date(stamp);
}
function currentWeek(at=new Date()) {
  const date=localDate(at,SEASON_ZONE);const weekday=new Date(`${date}T12:00:00Z`).getUTCDay(); const startDate=shiftDate(date,-((weekday+6)%7));
  const startsAt=midnightInZone(startDate,SEASON_ZONE).toISOString();const endsAt=midnightInZone(shiftDate(startDate,7),SEASON_ZONE).toISOString();
  const label=`${new Intl.DateTimeFormat('en-US',{timeZone:SEASON_ZONE,month:'short',day:'numeric'}).format(new Date(startsAt))} – ${new Intl.DateTimeFormat('en-US',{timeZone:SEASON_ZONE,month:'short',day:'numeric'}).format(new Date(new Date(endsAt).getTime()-1))}`;
  return {id:`week-${startDate}`,startDate,startsAt,endsAt,label};
}
function profile(row:Row):Profile { let interests:string[]=[];try{interests=JSON.parse(row.interests||'[]')}catch{}return {id:row.id,name:row.name,interests,timezone:row.timezone,primeDemo:Boolean(row.prime_demo),onboarded:Boolean(row.onboarded)}; }
async function actorFrom(request:Request):Promise<Actor|null> {
  const token=cookieValue(request);if(token){const session=await one('SELECT * FROM demo_sessions WHERE token=?',token);if(session)return {id:session.slot==='b'?session.user_b:session.user_a,workspace:session.workspace,mode:'demo',session};}
  const auth=await getVerifiedUser();if(!auth)return null;
  const id=await resolveProfileId(auth.userId);
  await run('INSERT OR IGNORE INTO profiles (id,workspace,name,interests,timezone,prime_demo,onboarded,created_at) VALUES (?,\'live\',?,\'[]\',?,0,0,?)',id,auth.fullName||auth.email.split('@')[0]||'New learner',SEASON_ZONE,now());
  return {id,workspace:'live',mode:'account'};
}
async function requiredActor(request:Request) { const actor=await actorFrom(request);if(!actor)throw new ApiError(401,'SIGN_IN_REQUIRED','Sign in with email or start the clearly labeled demo to continue.');return actor; }
function globalCompetitionId(workspace:string,seasonId:string) { return `global:${workspace}:${seasonId}`; }
function rankScope(competition:Row):string { return competition.kind==='global'?`global:${competition.workspace}`:`friends:${competition.id}`; }
async function ensureSeason(workspace:string) {
  const week=currentWeek();
  await database().batch([
    database().prepare('INSERT OR IGNORE INTO seasons (id,starts_at,ends_at) VALUES (?,?,?)').bind(week.id,week.startsAt,week.endsAt),
    database().prepare('INSERT OR IGNORE INTO competitions (id,workspace,name,description,kind,creator_id,code,created_at) VALUES (?,?,?, ?,\'global\',NULL,NULL,?)').bind(globalCompetitionId(workspace,week.id),workspace,'The weekly world league','Different skills. One shared scoreboard. Show up daily and compete with learners in your rank.',now()),
  ]);
  return week;
}
async function streakFor(userId:string,date:string):Promise<number> {
  const completed=await rows('SELECT DISTINCT local_date FROM daily_checkins WHERE user_id=? AND local_date<=? ORDER BY local_date DESC LIMIT 370',userId,date);
  return streakFromDates(new Set(completed.map(r=>r.local_date)),date);
}
function streakFromDates(dates:Set<string>,date:string):number {
  let cursor=dates.has(date)?date:shiftDate(date,-1);let count=0;
  while(dates.has(cursor)&&count<370){count++;cursor=shiftDate(cursor,-1);}return count;
}
async function ensureRank(userId:string,scopeId:string,seasonId:string) { await run('INSERT OR IGNORE INTO rank_records (id,user_id,scope_id,tier,last_season,updated_at) VALUES (?,?,?,\'Bronze\',?,?)',uid(),userId,scopeId,seasonId,now()); }
// Rollover is run on the first authorized request in a new season. Every update
// compares the old season, so simultaneous requests cannot promote someone twice.
async function rolloverRanks(competition:Row,seasonId:string) {
  const scope=rankScope(competition);
  await run("INSERT OR IGNORE INTO rank_records (id,user_id,scope_id,tier,last_season,updated_at) SELECT lower(hex(randomblob(16))),user_id,?,'Bronze',?,? FROM competition_members WHERE competition_id=?",scope,seasonId,now(),competition.id);
  const existing=await rows('SELECT * FROM rank_records WHERE scope_id=? AND last_season<>?',scope,seasonId);
  for(const old of [...new Set(existing.map(r=>r.last_season))]){
    const cohort=existing.filter(r=>r.last_season===old);
    const stats=await rows('SELECT user_id,COALESCE(SUM(points),0) AS score,COUNT(DISTINCT local_date) AS active_days FROM score_events WHERE season_id=? GROUP BY user_id',old);
    const byUser=new Map(stats.map(r=>[r.user_id,r]));
    const scoreOf=(id:string)=>Number(byUser.get(id)?.score||0);
    const updates=cohort.map(row=>{
      const score=scoreOf(row.user_id),days=Number(byUser.get(row.user_id)?.active_days||0);
      const peers=cohort.filter(c=>c.tier===row.tier&&Number(byUser.get(c.user_id)?.active_days||0)>=5);
      const position=1+cohort.filter(c=>scoreOf(c.user_id)>score).length;
      const higher=peers.filter(c=>scoreOf(c.user_id)>score).length;
      const equal=peers.filter(c=>scoreOf(c.user_id)===score).length;
      const lower=peers.length-higher-equal;
      const quota=Math.max(1,Math.floor(peers.length*.2));
      const idx=TIERS.indexOf(row.tier);let next=row.tier as Tier;let reason:string;
      if(days<5)reason=`Rank held: ${days} active day${days===1?'':'s'}; at least 5 are required.`;
      else if(peers.length<10)reason=`Rank held: ${peers.length} qualifying same-rank participant${peers.length===1?'':'s'}; at least 10 are required.`;
      else if((higher<quota&&higher+equal>quota)||(lower<quota&&lower+equal>quota))reason='Rank held: a tied score group crossed the 20% promotion or demotion boundary.';
      else if(higher+equal<=quota){if(idx<4){next=TIERS[idx+1];reason='Promoted: your entire tied score group finished inside the top 20% of qualifying same-rank participants.';}else reason='Rank held: Diamond is the highest rank.';}
      else if(lower+equal<=quota){if(idx>0){next=TIERS[idx-1];reason='Demoted: your entire tied score group finished inside the bottom 20% of qualifying same-rank participants.';}else reason='Rank held: Bronze is the starting rank.';}
      else reason='Rank held: your result was outside the promotion and demotion quotas.';
      return {id:row.id,historyId:uid(),userId:row.user_id,fromTier:row.tier,next,score,days,reason,position,participants:cohort.length};
    });
    if(updates.length){const stamp=now(),changes=JSON.stringify(updates);await database().batch([
      database().prepare(`INSERT OR IGNORE INTO rank_history (id,user_id,scope_id,season_id,from_tier,to_tier,score,active_days,created_at,reason,position,participants) SELECT json_extract(value,'$.historyId'),json_extract(value,'$.userId'),?,?,json_extract(value,'$.fromTier'),json_extract(value,'$.next'),json_extract(value,'$.score'),json_extract(value,'$.days'),?,json_extract(value,'$.reason'),json_extract(value,'$.position'),json_extract(value,'$.participants') FROM json_each(?)`).bind(scope,old,stamp,changes),
      database().prepare(`UPDATE rank_records SET tier=(SELECT json_extract(value,'$.next') FROM json_each(?) WHERE json_extract(value,'$.id')=rank_records.id),last_season=?,updated_at=? WHERE last_season=? AND id IN (SELECT json_extract(value,'$.id') FROM json_each(?))`).bind(changes,seasonId,stamp,old,changes),
    ]);}
  }
}
async function applyScheduledLevels(actor:Actor,seasonId:string) {
  const due=currentWeek().startsAt;
  // Both updates are atomic and run BEFORE automatic weekly locks. A historical
  // score/check-in can never be re-graded by a scheduled level change.
  const eligible=`g.user_id=? AND g.archived=0 AND g.next_level IN ('light','standard','stretch') AND g.next_level_starts_at<=? AND NOT EXISTS(SELECT 1 FROM daily_checkins c WHERE c.user_id=g.user_id AND c.template_id=g.template_id AND c.season_id=?)`;
  await database().batch([
    database().prepare(`UPDATE template_locks SET level=(SELECT g.next_level FROM goals g WHERE g.user_id=template_locks.user_id AND g.template_id=template_locks.template_id AND ${eligible} LIMIT 1) WHERE user_id=? AND season_id=? AND EXISTS(SELECT 1 FROM goals g WHERE g.user_id=template_locks.user_id AND g.template_id=template_locks.template_id AND ${eligible})`).bind(actor.id,due,seasonId,actor.id,seasonId,actor.id,due,seasonId),
    database().prepare(`UPDATE goals AS g SET level=next_level,next_level=NULL,next_level_starts_at=NULL WHERE ${eligible}`).bind(actor.id,due,seasonId),
  ]);
}
async function ensureGoalLocks(actor:Actor,seasonId:string) {
  await applyScheduledLevels(actor,seasonId);
  // Carried goals are locked as soon as a new season is viewed or mutated.
  // Existing completions win over newly re-created goals during repair.
  const carried=await rows('SELECT g.*,EXISTS(SELECT 1 FROM daily_checkins c WHERE c.goal_id=g.id AND c.season_id=?) AS already_practiced FROM goals g WHERE g.user_id=? AND (g.archived=0 OR EXISTS(SELECT 1 FROM daily_checkins c WHERE c.goal_id=g.id AND c.season_id=?)) ORDER BY already_practiced DESC,g.created_at ASC',seasonId,actor.id,seasonId);
  const seen=new Set<string>();const statements:D1PreparedStatement[]=[];
  for(const g of carried){if(seen.has(g.template_id))continue;seen.add(g.template_id);statements.push(database().prepare('INSERT OR IGNORE INTO template_locks (id,user_id,template_id,season_id,level) VALUES (?,?,?,?,?)').bind(uid(),actor.id,g.template_id,seasonId,g.level));}
  if(statements.length)await database().batch(statements);
}
async function assertGoalLevel(actor:Actor,goal:Row) {
  const seasonId=currentWeek().id;
  await run('INSERT OR IGNORE INTO template_locks (id,user_id,template_id,season_id,level) VALUES (?,?,?,?,?)',uid(),actor.id,goal.template_id,seasonId,goal.level);
  const locked=await one('SELECT level FROM template_locks WHERE user_id=? AND template_id=? AND season_id=?',actor.id,goal.template_id,seasonId);
  if(locked?.level!==goal.level)throw new ApiError(409,'LEVEL_LOCKED','This skill’s level is locked for this weekly season. Archive it and re-add the original level.');
}
async function getOwnedGoal(actor:Actor,goalId:unknown):Promise<Row> { if(typeof goalId!=='string')throw new ApiError(400,'INVALID_GOAL','Choose a goal.'); const goal=await one('SELECT * FROM goals WHERE id=? AND user_id=? AND archived=0',goalId,actor.id);if(!goal)throw new ApiError(404,'GOAL_NOT_FOUND','That goal is not available in your account.');return goal; }
async function taskFor(actor:Actor,goalId:unknown):Promise<TaskChallenge> {
  await ensureGoalLocks(actor,currentWeek().id);const goal=await getOwnedGoal(actor,goalId);await assertGoalLevel(actor,goal);const p=await one('SELECT timezone FROM profiles WHERE id=?',actor.id);const date=localDate(new Date(),p!.timezone);const task=getChallenge(goal.template_id,goal.level as Level,date);
  return {goalId:goal.id,taskDate:date,title:task.title,verification:task.verification,prompt:task.prompt,points:task.points,...(task.questions?{questions:task.questions.map(q=>({id:q.id,question:q.question,options:q.options}))}:{}),...(task.minWords?{minWords:task.minWords}:{})};
}
function seasonLabel(startsAt:string,endsAt:string):string {
  const format=new Intl.DateTimeFormat('en-US',{timeZone:SEASON_ZONE,month:'short',day:'numeric'});
  return `${format.format(new Date(startsAt))} – ${format.format(new Date(new Date(endsAt).getTime()-1))}`;
}
async function weeklySummaries(actor:Actor,competition:Row|null):Promise<WeeklySummary[]> {
  const scope=competition?rankScope(competition):`personal:${actor.id}`;
  const membershipCheck=!competition?'1=1':competition.kind==='friends'
    ? `EXISTS(SELECT 1 FROM competition_members m WHERE m.competition_id=? AND m.user_id=? AND m.created_at<s.ends_at) AND ?<s.ends_at`
    : `EXISTS(SELECT 1 FROM competition_members m JOIN competitions c ON c.id=m.competition_id WHERE m.user_id=? AND c.workspace=? AND c.kind='global' AND c.id=('global:'||?||':'||s.id) AND m.created_at<s.ends_at)`;
  const memberValues=!competition?[]:competition.kind==='friends'?[competition.id,actor.id,competition.created_at]:[actor.id,actor.workspace,actor.workspace];
  const data=await rows(`SELECT s.id,s.starts_at,s.ends_at,h.id AS snapshot_id,h.from_tier,h.to_tier,h.reason,h.position,h.participants,h.score AS snapshot_score,h.active_days AS snapshot_days,COALESCE(SUM(e.points),0) AS score,COUNT(e.id) AS completed_count,COUNT(DISTINCT e.local_date) AS active_days FROM seasons s LEFT JOIN score_events e ON e.season_id=s.id AND e.user_id=? LEFT JOIN rank_history h ON h.season_id=s.id AND h.user_id=? AND h.scope_id=? WHERE s.ends_at<=? AND (h.id IS NOT NULL OR EXISTS(SELECT 1 FROM score_events own WHERE own.season_id=s.id AND own.user_id=?)) AND (h.id IS NOT NULL OR (${membershipCheck})) GROUP BY s.id ORDER BY s.starts_at DESC LIMIT 9`,actor.id,actor.id,scope,now(),actor.id,...memberValues);
  const byId=new Map(data.map(r=>[r.id,r]));
  return data.slice(0,8).map(row=>{
    const previous=byId.get(`week-${shiftDate(row.id.slice(5),-7)}`);
    const legacy=Boolean(row.snapshot_id)&&!row.reason;
    return {id:row.id,label:seasonLabel(row.starts_at,row.ends_at),startsAt:row.starts_at,endsAt:row.ends_at,score:Number(row.score),activeDays:Number(row.active_days),completedCount:Number(row.completed_count),previousScore:previous?Number(previous.score):null,position:row.position==null?null:Number(row.position),participants:row.participants==null?null:Number(row.participants),scopeName:competition?.name||'Personal practice',rankBefore:competition?(row.from_tier||null):null,rankAfter:competition?(row.to_tier||null):null,rankReason:!competition?'Personal practice summary; competition ranks are shown in their own scopes.':row.reason||(legacy?'Detailed rank reasoning and placement were not captured for this legacy week.':'No rank result has been recorded for this completed week.')};
  });
}
async function historyCompetition(actor:Actor,selectedId?:string):Promise<Row|null> {
  const week=await ensureSeason(actor.workspace);
  let competition:Row|null=null;
  if(selectedId)competition=await one('SELECT * FROM competitions WHERE id=? AND workspace=?',selectedId,actor.workspace);
  else {
    const person=await one('SELECT prime_demo FROM profiles WHERE id=?',actor.id);
    if(person?.prime_demo)competition=await one("SELECT c.* FROM competitions c JOIN competition_members m ON m.competition_id=c.id WHERE c.id=? AND c.workspace=? AND m.user_id=?",globalCompetitionId(actor.workspace,week.id),actor.workspace,actor.id);
    if(!competition)competition=await one("SELECT c.* FROM competitions c JOIN competition_members m ON m.competition_id=c.id WHERE c.kind='friends' AND c.workspace=? AND m.user_id=? ORDER BY c.created_at DESC LIMIT 1",actor.workspace,actor.id);
    if(!competition)return null;
  }
  if(!competition)throw new ApiError(404,'HISTORY_NOT_FOUND','This competition history is not available.');
  if(competition.kind==='friends'&&!await one('SELECT id FROM competition_members WHERE competition_id=? AND user_id=?',competition.id,actor.id))throw new ApiError(403,'PRIVATE_COMPETITION','Only group members can access their results in this competition.');
  return competition;
}
async function weekDetail(actor:Actor,weekId:string,selectedId?:string):Promise<WeekDetail> {
  if(!/^week-\d{4}-\d{2}-\d{2}$/.test(weekId))throw new ApiError(400,'INVALID_WEEK','Choose a completed week from your history.');
  const competition=await historyCompetition(actor,selectedId);
  if(competition)await rolloverRanks(competition,currentWeek().id);
  const summary=(await weeklySummaries(actor,competition)).find(w=>w.id===weekId);
  if(!summary)throw new ApiError(404,'HISTORY_NOT_FOUND','This completed week is not available in your history.');
  const records=await rows('SELECT c.*,e.points FROM daily_checkins c LEFT JOIN score_events e ON e.checkin_id=c.id WHERE c.user_id=? AND c.season_id=? ORDER BY c.local_date DESC,c.created_at DESC LIMIT 100',actor.id,weekId);
  const activities:PracticeRecord[]=records.map(c=>({id:c.id,date:c.local_date,title:c.task_title||TEMPLATES.find(t=>t.id===c.template_id)?.title||'Archived skill activity',verification:c.verification,points:Number(c.points||0),prompt:c.task_prompt||'The original task prompt was not stored for this legacy activity.',submission:c.verification==='writing'?c.evidence:null}));
  return {summary,activities};
}

async function getState(actor:Actor|null,selectedId?:string):Promise<AppState> {
  const workspace=actor?.workspace||'live';const week=await ensureSeason(workspace);const person=actor?await one('SELECT * FROM profiles WHERE id=?',actor.id):null;
  const viewer=person?profile(person):null;if(actor)await ensureGoalLocks(actor,week.id);const date=localDate(new Date(),viewer?.timezone||SEASON_ZONE);
  const globalId=globalCompetitionId(workspace,week.id);
  const competitionRows=await rows(`SELECT c.*, (SELECT COUNT(*) FROM competition_members cm WHERE cm.competition_id=c.id) AS members, EXISTS(SELECT 1 FROM competition_members mine WHERE mine.competition_id=c.id AND mine.user_id=?) AS joined FROM competitions c WHERE c.workspace=? AND (c.id=? OR (c.kind='friends' AND EXISTS(SELECT 1 FROM competition_members cm WHERE cm.competition_id=c.id AND cm.user_id=?))) ORDER BY CASE c.kind WHEN 'global' THEN 1 ELSE 0 END,c.created_at DESC`,actor?.id||'',workspace,globalId,actor?.id||'');
  let selected:Row|undefined;
  if(selectedId){ selected=competitionRows.find(c=>c.id===selectedId);if(!selected)throw new ApiError(403,'PRIVATE_COMPETITION','Only invited members can view this competition.'); }
  else selected=(viewer?.primeDemo?competitionRows.find(c=>c.id===globalId&&c.joined):undefined)||competitionRows.find(c=>c.kind==='friends'&&c.joined)||competitionRows.find(c=>c.id===globalId);
  const scope=selected?rankScope(selected):`global:${workspace}`;
  const canViewBoard=Boolean(selected&&(selected.kind==='friends'||viewer?.primeDemo));
  if(selected&&actor)await rolloverRanks(selected,week.id);
  const goalRows=actor?await rows('SELECT g.*,EXISTS(SELECT 1 FROM daily_checkins c WHERE c.user_id=g.user_id AND c.template_id=g.template_id AND c.local_date=?) AS completed_today FROM goals g WHERE g.user_id=? AND g.archived=0 ORDER BY g.created_at ASC',date,actor.id):[];
  const goalViews:GoalView[]=goalRows.map(g=>{const t=TEMPLATES.find(t=>t.id===g.template_id);return t?{id:g.id,templateId:t.id,level:g.level,createdAt:g.created_at,completedToday:Boolean(g.completed_today),points:t.levels[g.level as Level].points,title:t.title,category:t.category,verification:t.verification,nextLevel:g.next_level||null,nextLevelStartsAt:g.next_level_starts_at||null}:null}).filter(Boolean) as GoalView[];
  const dayStats=actor?await one('SELECT COALESCE(SUM(points),0) AS score FROM score_events WHERE user_id=? AND local_date=?',actor.id,date):null;
  const completedCount=actor?await one('SELECT COUNT(*) AS count FROM daily_checkins WHERE user_id=? AND local_date=?',actor.id,date):null;
  const weekStats=actor?await rows('SELECT local_date,COALESCE(SUM(points),0) AS score FROM score_events WHERE user_id=? AND season_id=? GROUP BY local_date',actor.id,week.id):[];
  const byDate=new Map(weekStats.map(s=>[s.local_date,Number(s.score)]));
  const firstLocal=localDate(new Date(week.startsAt),viewer?.timezone||SEASON_ZONE);const lastLocal=localDate(new Date(new Date(week.endsAt).getTime()-1),viewer?.timezone||SEASON_ZONE);const days=[];
  for(let d=firstLocal;d<=lastLocal;d=shiftDate(d,1)){days.push({date:d,label:new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short'}).format(new Date(`${d}T12:00:00Z`)),score:byDate.get(d)||0});if(days.length>=8)break;}
  const boardRows=selected&&canViewBoard?await rows(`SELECT p.id,p.name,p.timezone,COALESCE(SUM(s.points),0) AS score,COALESCE(r.tier,'Bronze') AS tier FROM competition_members m JOIN profiles p ON p.id=m.user_id LEFT JOIN score_events s ON s.user_id=p.id AND s.season_id=? LEFT JOIN rank_records r ON r.user_id=p.id AND r.scope_id=? WHERE m.competition_id=? AND p.workspace=? GROUP BY p.id ORDER BY score DESC,p.name ASC,p.id ASC LIMIT 100`,week.id,scope,selected.id,workspace):[];
  // Read all visible competitors' streak dates in one query instead of one query per row.
  const boardDates=new Map<string,Set<string>>();
  if(boardRows.length){
    const todayDates=boardRows.map(b=>localDate(new Date(),b.timezone)).sort();
    for(const b of boardRows)boardDates.set(b.id,new Set());
    // D1 permits at most 100 bound parameters; reserve two for the date range.
    for(let offset=0;offset<boardRows.length;offset+=98){
      const chunk=boardRows.slice(offset,offset+98);
      const dates=await rows(`SELECT DISTINCT user_id,local_date FROM daily_checkins WHERE user_id IN (${chunk.map(()=>'?').join(',')}) AND local_date BETWEEN ? AND ?`,...chunk.map(b=>b.id),shiftDate(todayDates[0],-370),todayDates[todayDates.length-1]);
      for(const d of dates)boardDates.get(d.user_id)?.add(d.local_date);
    }
  }
  const leaderboard:LeaderboardEntry[]=boardRows.map((b,i)=>({userId:b.id,name:b.name,score:Number(b.score),streak:streakFromDates(boardDates.get(b.id)||new Set(),localDate(new Date(),b.timezone)),tier:(TIERS.includes(b.tier)?b.tier:'Bronze') as Tier,isYou:b.id===actor?.id,position:1+boardRows.filter(peer=>Number(peer.score)>Number(b.score)).length}));
  const rankRow=actor?await one('SELECT * FROM rank_records WHERE user_id=? AND scope_id=?',actor.id,scope):null;const tier=(rankRow?.tier||'Bronze') as Tier;const tierIdx=TIERS.indexOf(tier);
  const comps:CompetitionView[]=competitionRows.map(c=>({id:c.id,name:c.name,description:c.description,kind:c.kind,members:Number(c.members),joined:Boolean(c.joined)&&(c.kind!=='global'||Boolean(viewer?.primeDemo)),...(c.code&&c.joined?{code:c.code}:{}),endsAt:week.endsAt}));
  const historyScope=!selectedId&&(!selected?.joined||(selected.kind==='global'&&!viewer?.primeDemo))?null:selected||null;
  const history=actor?await weeklySummaries(actor,historyScope):[];
  const plannedCount=goalViews.length,completedPlannedCount=goalViews.filter(g=>g.completedToday).length;
  return {mode:actor?.mode||'anonymous',viewer,templates:TEMPLATES,goals:goalViews,today:{date,score:Number(dayStats?.score||0),limit:DAILY_CAP,streak:actor?(boardDates.has(actor.id)?streakFromDates(boardDates.get(actor.id)!,date):await streakFor(actor.id,date)):0,completedCount:Number(completedCount?.count||0),plannedCount,completedPlannedCount,planComplete:plannedCount>0&&completedPlannedCount===plannedCount,nextResetAt:midnightInZone(shiftDate(date,1),viewer?.timezone||SEASON_ZONE).toISOString()},week:{id:week.id,label:week.label,startsAt:week.startsAt,endsAt:week.endsAt,days},rank:{tier,nextTier:TIERS[tierIdx+1]||null,activeDays:weekStats.length,qualifyingDays:5,members:leaderboard.filter(u=>u.tier===tier).length,position:leaderboard.find(u=>u.isYou)?.position||null},competitions:comps,leaderboard,history};
}
async function beginDemo(request:Request):Promise<{actor:Actor;cookie:string}> {
  const existingToken=cookieValue(request);const existing=existingToken?await one('SELECT * FROM demo_sessions WHERE token=?',existingToken):null;
  if(existing)return {actor:{id:existing.slot==='b'?existing.user_b:existing.user_a,workspace:existing.workspace,mode:'demo',session:existing},cookie:cookieHeader(request,existingToken!)};
  const workspace=`demo:${uid()}`;const a=`demo:${uid()}`,b=`demo:${uid()}`,token=`${uid()}${uid()}`;const week=await ensureSeason(workspace);const stamp=now();const previousWeek=currentWeek(new Date(new Date(week.startsAt).getTime()-1));const fixtureStamp=previousWeek.startsAt;const friendId=uid();const code=uid().replaceAll('-','').slice(0,10).toUpperCase();
  await database().batch([
    database().prepare('INSERT INTO profiles (id,workspace,name,interests,timezone,prime_demo,onboarded,created_at) VALUES (?,?,?, ?,?,0,1,?)').bind(a,workspace,'Alex Morgan',JSON.stringify(['Languages','Technology']),SEASON_ZONE,fixtureStamp),
    database().prepare('INSERT INTO profiles (id,workspace,name,interests,timezone,prime_demo,onboarded,created_at) VALUES (?,?,?, ?,?,1,1,?)').bind(b,workspace,'Jordan Lee',JSON.stringify(['Writing','Thinking']),SEASON_ZONE,fixtureStamp),
    database().prepare('INSERT INTO demo_sessions (token,workspace,user_a,user_b,slot,created_at) VALUES (?,?,?,?,\'a\',?)').bind(token,workspace,a,b,stamp),
    database().prepare('INSERT INTO competitions (id,workspace,name,description,kind,creator_id,code,created_at) VALUES (?,?,?,?,\'friends\',?,?,?)').bind(friendId,workspace,'The consistency club','An isolated example group for two fictional demo participants.',a,code,fixtureStamp),
    database().prepare('INSERT INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)').bind(uid(),friendId,a,fixtureStamp),
    database().prepare('INSERT INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)').bind(uid(),friendId,b,fixtureStamp),
    database().prepare('INSERT INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)').bind(uid(),globalCompetitionId(workspace,week.id),b,stamp),
  ]);
  const chosen=[{user:a,template:'spanish-daily'},{user:a,template:'javascript-daily'},{user:a,template:'writing-daily'},{user:b,template:'critical-thinking'},{user:b,template:'clear-communication'}];
  const goalData=chosen.map(c=>({...c,id:uid()}));
  await database().batch(goalData.flatMap(g=>[
    database().prepare('INSERT INTO goals (id,user_id,template_id,level,archived,created_at) VALUES (?,?,?,\'standard\',0,?)').bind(g.id,g.user,g.template,fixtureStamp),
    database().prepare('INSERT INTO template_locks (id,user_id,template_id,season_id,level) VALUES (?,?,?,?,\'standard\')').bind(uid(),g.user,g.template,week.id),
  ]));
  // Exactly one completed fictional week is persisted for the isolated demo.
  // It uses the actual score trigger and authored task snapshots. Account history
  // is never seeded, and today's demo tasks remain genuinely uncompleted.
  await database().batch([
    database().prepare('INSERT INTO seasons (id,starts_at,ends_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(previousWeek.id,previousWeek.startsAt,previousWeek.endsAt),
    database().prepare("INSERT INTO competitions (id,workspace,name,description,kind,creator_id,code,created_at) VALUES (?,?,?,?,'global',NULL,NULL,?)").bind(globalCompetitionId(workspace,previousWeek.id),workspace,'The weekly world league','Fictional completed world-league season in this demo only.',fixtureStamp),
    database().prepare('INSERT INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)').bind(uid(),globalCompetitionId(workspace,previousWeek.id),b,fixtureStamp),
    database().prepare("INSERT INTO rank_records (id,user_id,scope_id,tier,last_season,updated_at) VALUES (?,?,?,'Bronze',?,?)").bind(uid(),a,`friends:${friendId}`,previousWeek.id,fixtureStamp),
    database().prepare("INSERT INTO rank_records (id,user_id,scope_id,tier,last_season,updated_at) VALUES (?,?,?,'Bronze',?,?)").bind(uid(),b,`friends:${friendId}`,previousWeek.id,fixtureStamp),
    database().prepare("INSERT INTO rank_records (id,user_id,scope_id,tier,last_season,updated_at) VALUES (?,?,?,'Bronze',?,?)").bind(uid(),b,`global:${workspace}`,previousWeek.id,fixtureStamp),
  ]);
  const today=localDate(new Date(),SEASON_ZONE);const seeds:Row[]=[];
  const demoWriting='This is a fictional demo submission. I set a practical learning goal and made time for deliberate practice. I described a specific example, considered a different perspective, and revised my first attempt to make the main idea clearer. Consistency helped me notice what was working and what needed attention. Tomorrow I would repeat the useful parts of this routine, ask for focused feedback, and try one manageable improvement. This paragraph illustrates how a saved writing exercise appears in personal history. It is sample content, not a real user result, independent quality assessment, or evidence that the learner mastered the skill.';
  for(const seedWeek of [previousWeek,week]){
    const stop=seedWeek.id===previousWeek.id?shiftDate(previousWeek.startDate,5):today;
    for(let d=seedWeek.startDate;d<stop;d=shiftDate(d,1))for(const g of goalData){const t=TEMPLATES.find(t=>t.id===g.template);if(!t)continue;const challenge=getChallenge(g.template,'standard',d);seeds.push({id:uid(),user:g.user,goal:g.id,template:g.template,date:d,season:seedWeek.id,points:t.levels.standard.points,verification:t.verification,evidence:t.verification==='writing'?demoWriting:'Fictional demo history',created:`${d}T16:00:00Z`,prompt:challenge.prompt,title:challenge.title});}
  }
  if(seeds.length)await run(`INSERT INTO daily_checkins (id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,evidence,created_at,task_prompt,task_title,task_level) SELECT json_extract(value,'$.id'),json_extract(value,'$.user'),json_extract(value,'$.goal'),json_extract(value,'$.template'),json_extract(value,'$.date'),json_extract(value,'$.season'),json_extract(value,'$.points'),json_extract(value,'$.verification'),json_extract(value,'$.evidence'),json_extract(value,'$.created'),json_extract(value,'$.prompt'),json_extract(value,'$.title'),'standard' FROM json_each(?)`,JSON.stringify(seeds));
  const session=await one('SELECT * FROM demo_sessions WHERE token=?',token);
  return {actor:{id:a,workspace,mode:'demo',session:session!},cookie:cookieHeader(request,token)};
}
function validateMutation(request:Request) {
  let expectedOrigin:string;try{expectedOrigin=publicOrigin(request);}catch{throw new ApiError(503,'SITE_UNAVAILABLE','Kampit site setup is incomplete. Please try again shortly.');} const origin=request.headers.get('origin');if(origin&&origin!==expectedOrigin)throw new ApiError(403,'CROSS_ORIGIN','This action must be submitted from Kampit.');
  if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'CROSS_ORIGIN','This action must be submitted from Kampit.');
  if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'JSON_REQUIRED','Send a JSON request.');
}
function textInput(value:unknown,field:string,min:number,max:number) { if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw new ApiError(400,'INVALID_INPUT',`${field} must contain ${min}–${max} characters.`);return value.trim(); }
function resultJSON(data:unknown,status=200,cookie?:string) { const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(cookie)h.append('Set-Cookie',cookie);return new Response(JSON.stringify(data),{status,headers:h}); }
function errorResponse(error:unknown) { if(error instanceof ApiError)return resultJSON({error:error.message,code:error.code},error.status); console.error('Kampit API failure',error instanceof Error?error.message:'Unknown error');return resultJSON({error:'Kampit could not complete this request. Please try again.',code:'INTERNAL_ERROR'},500); }
export async function handleGet(request:Request):Promise<Response> { try { const actor=await actorFrom(request);const url=new URL(request.url);if(url.searchParams.has('historyWeek')){if(!actor)throw new ApiError(401,'SIGN_IN_REQUIRED','Sign in or start the demo to view your own practice history.');return resultJSON(await weekDetail(actor,url.searchParams.get('historyWeek')!,url.searchParams.get('competitionId')||undefined));}if(url.searchParams.has('goalId')){if(!actor)throw new ApiError(401,'SIGN_IN_REQUIRED','Sign in or start the demo to open a task.');return resultJSON(await taskFor(actor,url.searchParams.get('goalId')));}return resultJSON(await getState(actor,url.searchParams.get('competitionId')||undefined)); }catch(e){return errorResponse(e);} }
export async function handlePost(request:Request):Promise<Response> {
  try{
    validateMutation(request);const raw=await request.text();if(raw.length>40000)throw new ApiError(413,'TOO_LARGE','That submission is too large.');let body:Row;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'INVALID_JSON','The request could not be read.');}if(!body||typeof body!=='object'||typeof body.action!=='string')throw new ApiError(400,'INVALID_ACTION','Choose a valid action.');const p=(body.payload&&typeof body.payload==='object'&&!Array.isArray(body.payload)?body.payload:{}) as Row;
    let actor:Actor;let responseCookie:string|undefined;let message='';let result:ApiResponse['result'];
    if(body.action==='demo'){const demo=await beginDemo(request);actor=demo.actor;responseCookie=demo.cookie;message='Demo workspace ready. The people and past activity here are fictional.';}
    else if(body.action==='leave-demo'){responseCookie=cookieHeader(request,'',0);const cleanHeaders=new Headers(request.headers);cleanHeaders.delete('cookie');const clean=new Request(request.url,{headers:cleanHeaders});const account=await actorFrom(clean);return resultJSON({state:await getState(account),message:'Demo closed. Your account data is separate.'},200,responseCookie);}
    else{
      actor=await requiredActor(request);const week=await ensureSeason(actor.workspace);await ensureGoalLocks(actor,week.id);const person=(await one('SELECT * FROM profiles WHERE id=?',actor.id))!;
      switch(body.action){
        case 'switch-demo':{if(actor.mode!=='demo'||!actor.session)throw new ApiError(403,'DEMO_ONLY','Switching participants is available only in the isolated demo.');const slot=actor.session.slot==='a'?'b':'a';await run('UPDATE demo_sessions SET slot=? WHERE token=?',slot,actor.session.token);actor={...actor,id:slot==='a'?actor.session.user_a:actor.session.user_b,session:{...actor.session,slot}};message='Switched fictional demo participant.';break;}
        case 'onboard':{const name=textInput(p.name,'Display name',2,40);const interests=Array.isArray(p.interests)?[...new Set(p.interests.filter((v:unknown)=>typeof v==='string'&&v.length<=60))].slice(0,12):[];if(!interests.length)throw new ApiError(400,'INTERESTS_REQUIRED','Choose at least one skill interest.');const timezone=validZone(p.timezone);const activity=await one('SELECT id FROM daily_checkins WHERE user_id=? LIMIT 1',actor.id);if(activity&&timezone!==person.timezone)throw new ApiError(409,'TIMEZONE_LOCKED','Your time zone is locked after your first activity to keep daily scoring fair.');await run('UPDATE profiles SET name=?,interests=?,timezone=?,onboarded=1 WHERE id=?',name,JSON.stringify(interests),timezone,actor.id);message='Your learning profile is ready.';break;}
        case 'add-goal':{const template=TEMPLATES.find(t=>t.id===p.templateId);if(!template)throw new ApiError(400,'INVALID_TEMPLATE','Choose a goal from the skill library.');if(!['light','standard','stretch'].includes(p.level))throw new ApiError(400,'INVALID_LEVEL','Choose Light, Standard or Stretch.');const active=await one('SELECT id FROM goals WHERE user_id=? AND template_id=? AND archived=0',actor.id,template.id);if(active)throw new ApiError(409,'GOAL_EXISTS','This skill is already in your active plan.');await run('INSERT OR IGNORE INTO template_locks (id,user_id,template_id,season_id,level) VALUES (?,?,?,?,?)',uid(),actor.id,template.id,week.id,p.level);const locked=await one('SELECT level FROM template_locks WHERE user_id=? AND template_id=? AND season_id=?',actor.id,template.id,week.id);if(locked!.level!==p.level)throw new ApiError(409,'LEVEL_LOCKED','This skill’s level is locked until the next weekly season.');try{await run('INSERT INTO goals (id,user_id,template_id,level,archived,created_at) VALUES (?,?,?,?,0,?)',uid(),actor.id,template.id,p.level,now());}catch{throw new ApiError(409,'GOAL_EXISTS','This skill is already in your active plan.');}message='Goal added. Your level stays fixed for this weekly season.';break;}
        case 'schedule-level':{const goal=await getOwnedGoal(actor,p.goalId);if(!['light','standard','stretch'].includes(p.level))throw new ApiError(400,'INVALID_LEVEL','Choose Light, Standard or Stretch.');const cancel=p.level===goal.level;await run('UPDATE goals SET next_level=?,next_level_starts_at=? WHERE id=? AND user_id=?',cancel?null:p.level,cancel?null:week.endsAt,goal.id,actor.id);message=cancel?'Scheduled level change cancelled. Your current level is unchanged.':'Level change scheduled for the next weekly season. This week’s tasks and points are unchanged.';break;}
        case 'archive-goal':{const goal=await getOwnedGoal(actor,p.goalId);await run('UPDATE goals SET archived=1 WHERE id=? AND user_id=?',goal.id,actor.id);message='Goal archived. Earned points remain in your week.';break;}
        case 'complete-goal':{const goal=await getOwnedGoal(actor,p.goalId);await assertGoalLevel(actor,goal);const date=localDate(new Date(),person.timezone);if(p.taskDate!==undefined&&p.taskDate!==date)throw new ApiError(409,'TASK_EXPIRED','A new day has started. Refresh this task before submitting; your draft is still yours.');const duplicate=await one('SELECT id FROM daily_checkins WHERE user_id=? AND template_id=? AND local_date=?',actor.id,goal.template_id,date);if(duplicate)throw new ApiError(409,'ALREADY_COMPLETED','You already completed this skill today. Come back tomorrow for the next task.');const challenge=getChallenge(goal.template_id,goal.level as Level,date);let evidence='';
          if(challenge.verification==='quiz'){const questions=challenge.questions||[];if(!questions.length)throw new ApiError(503,'TASK_UNAVAILABLE','This task is temporarily unavailable.');const answers=p.answers;if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new ApiError(400,'ANSWERS_REQUIRED','Answer every question before submitting.');const complete=questions.every(q=>Number.isInteger(answers[q.id])&&answers[q.id]>=0&&answers[q.id]<q.options.length);if(!complete)throw new ApiError(400,'ANSWERS_REQUIRED','Answer every question before submitting.');const wrong=questions.filter(q=>answers[q.id]!==q.answer);if(wrong.length){const feedback=wrong.map(q=>q.explanation).filter(Boolean).join(' ');return resultJSON({state:await getState(actor,p.viewCompetitionId),message:'Keep learning — review the explanation and try again.',result:{passed:false,awarded:0,feedback:feedback||'At least one answer needs another look.'}});}evidence=JSON.stringify({answers,questionIds:questions.map(q=>q.id)});
          }else if(challenge.verification==='writing'){const text=textInput(p.text,'Your writing',1,20000);const words=text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)||[];if(words.length<(challenge.minWords||50))throw new ApiError(400,'WRITING_TOO_SHORT',`Write at least ${challenge.minWords||50} words before submitting.`);const distinct=new Set(words.map(w=>w.toLowerCase()));if(distinct.size<Math.min(15,Math.max(6,Math.floor((challenge.minWords||50)/8))))throw new ApiError(400,'WRITING_REPEATED','Use a varied response rather than repeating the same words.');evidence=text;
          }else evidence='Self-reported completion; no automated skill verification';
          const id=uid();const inserted=await run('INSERT OR IGNORE INTO daily_checkins (id,user_id,goal_id,template_id,local_date,season_id,base_points,verification,evidence,created_at,task_prompt,task_title,task_level) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',id,actor.id,goal.id,goal.template_id,date,week.id,challenge.points,challenge.verification,evidence,now(),challenge.prompt,challenge.title,goal.level);if(!inserted.meta.changes)throw new ApiError(409,'ALREADY_COMPLETED','You already completed this skill today.');const award=await one('SELECT points,streak_bonus FROM score_events WHERE checkin_id=?',id);result={passed:true,awarded:Number(award?.points||0),feedback:challenge.verification==='writing'?'Writing saved. The word count was checked; writing quality was not graded by AI.':challenge.verification==='self'?'Saved as a self-reported completion.':'All answers correct. Your practice is complete.'};message=Number(award?.points||0)>0?`Practice complete. +${award!.points} points${award?.streak_bonus?' including your daily streak bonus':''}.`:'Practice saved. You reached the 100-point daily ranking limit; your personal progress still counts.';break;}
        case 'create-group':{const name=textInput(p.name,'Group name',2,60);const id=uid(),code=uid().replaceAll('-','').slice(0,10).toUpperCase();const stamp=now();await database().batch([database().prepare('INSERT INTO competitions (id,workspace,name,description,kind,creator_id,code,created_at) VALUES (?,?,?,?,\'friends\',?,?,?)').bind(id,actor.workspace,name,'A private weekly skill competition. Different goals, shared momentum.',actor.id,code,stamp),database().prepare('INSERT INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)').bind(uid(),id,actor.id,stamp)]);await ensureRank(actor.id,`friends:${id}`,week.id);result={code};message='Private group created. Share the invite code with a friend who can access this site.';break;}
        case 'join-group':{const code=textInput(p.code,'Invite code',4,20).toUpperCase();const group=await one('SELECT * FROM competitions WHERE code=? AND kind=\'friends\' AND workspace=?',code,actor.workspace);if(!group)throw new ApiError(404,'INVITE_NOT_FOUND','That invite code was not found in this workspace.');await run('INSERT OR IGNORE INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)',uid(),group.id,actor.id,now());await ensureRank(actor.id,rankScope(group),week.id);message=`You joined ${group.name}.`;break;}
        case 'join-competition':{const c=await one('SELECT * FROM competitions WHERE id=? AND workspace=?',p.competitionId||'',actor.workspace);if(!c)throw new ApiError(404,'COMPETITION_NOT_FOUND','This competition was not found.');if(c.kind==='global'&&!person.prime_demo)throw new ApiError(403,'PRIME_REQUIRED','Prime access is required for the world league. You can enable clearly labeled no-charge demo access.');if(c.kind==='friends'){const membership=await one('SELECT id FROM competition_members WHERE competition_id=? AND user_id=?',c.id,actor.id);if(!membership)throw new ApiError(403,'INVITE_REQUIRED','Use a private invite code to join this group.');}await run('INSERT OR IGNORE INTO competition_members (id,competition_id,user_id,created_at) VALUES (?,?,?,?)',uid(),c.id,actor.id,now());await ensureRank(actor.id,rankScope(c),week.id);message=c.kind==='global'?'You joined this week’s world league.':'You are in this private competition.';break;}
        case 'prime-demo':{if(typeof p.enabled!=='boolean')throw new ApiError(400,'INVALID_INPUT','Choose whether to enable demo access.');await run('UPDATE profiles SET prime_demo=? WHERE id=?',p.enabled?1:0,actor.id);if(!p.enabled)await run('DELETE FROM competition_members WHERE user_id=? AND competition_id IN (SELECT id FROM competitions WHERE workspace=? AND kind=\'global\')',actor.id,actor.workspace);message=p.enabled?'Prime demo access enabled. This is not a paid subscription and no money was charged.':'Prime demo access disabled. Your personal progress is saved.';break;}
        default:throw new ApiError(400,'INVALID_ACTION','That action is not supported.');
      }
    }
    return resultJSON({state:await getState(actor,['demo','switch-demo'].includes(body.action)?undefined:p.viewCompetitionId),message,...(result?{result}:{})},200,responseCookie);
  }catch(e){return errorResponse(e);}
}
