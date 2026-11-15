// A deliberately bounded compatibility layer for Kampit's versioned D1 queries.
// It is not a general SQLite parser. New core SQL must pass the PG workflow suite.
export type Row = Record<string, any>;
export type QueryResult = { rows: Row[]; rowCount: number };
export interface Executor { query(sql:string,values?:unknown[]):Promise<QueryResult> }
export interface Driver extends Executor { transaction<T>(callback:(tx:Executor)=>Promise<T>):Promise<T> }
const TABLES='profiles|demo_sessions|seasons|goals|template_locks|competitions|competition_members|daily_checkins|score_events|rank_records|rank_history|identity_links';

export function compileSql(source:string):string {
  let sql=source.trim().replace(/;\s*$/,'');
  const ignore=/^INSERT\s+OR\s+IGNORE\s+/i.test(sql);
  sql=sql.replace(/^INSERT\s+OR\s+IGNORE\s+/i,'INSERT ')
    .replace(/lower\(hex\(randomblob\(16\)\)\)/gi,'gen_random_uuid()::text')
    .replace(/json_extract\(value,'\$\.([A-Za-z]+)'\)/g,(_,key)=>['points','score','days','position','participants'].includes(key)?`(value->>'${key}')::integer`:`(value->>'${key}')`)
    // Core binds JSON.stringify(...) text. Force parameter OID text (25), then
    // cast on the server: postgres.js otherwise JSON-stringifies it again for
    // inferred jsonb OID 3802, turning the array into a JSON string scalar.
    .replace(/json_each\(\?\)/g,'jsonb_array_elements((?::text)::jsonb) AS input(value)')
    .replace(/GROUP BY s\.id ORDER BY/g,'GROUP BY s.id,h.id ORDER BY')
    .replace(/GROUP BY p\.id ORDER BY/g,'GROUP BY p.id,r.tier ORDER BY');
  sql=sql.replace(new RegExp(`\\b(FROM|JOIN|UPDATE|INTO)\\s+(${TABLES})\\b`,'gi'),'$1 kampit.$2');
  if(ignore)sql+=' ON CONFLICT DO NOTHING';
  // Only bind markers outside quoted literals become PostgreSQL $n parameters.
  let out='',quote='',parameter=0;
  for(let i=0;i<sql.length;i++){
    const char=sql[i];
    if(quote){out+=char;if(char===quote){if(sql[i+1]===quote)out+=sql[++i];else quote='';}continue;}
    if(char==="'"||char==='"'){quote=char;out+=char;}else out+=char==='?'?`$${++parameter}`:char;
  }
  return out;
}

function checkinUsers(source:string,values:unknown[]):string[] {
  if(!/^INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+daily_checkins\b/i.test(source))return [];
  if(/FROM json_each\(\?\)/.test(source)){
    const rows=JSON.parse(String(values[values.length-1]));
    if(!Array.isArray(rows)||rows.some(r=>typeof r.user!=='string'))throw Error('Invalid bulk check-in users');
    return [...new Set(rows.map(r=>r.user as string))].sort();
  }
  const columns=source.match(/daily_checkins\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if(!columns)throw Error('Unrecognized scoring write: locking rule must be updated');
  const names=columns[1].split(',').map(s=>s.trim());
  const tokens=columns[2].split(',').map(s=>s.trim());
  const userIndex=names.indexOf('user_id');
  if(userIndex<0||tokens[userIndex]!=='?')throw Error('Unrecognized scoring user binding');
  const bindIndex=tokens.slice(0,userIndex).filter(s=>s==='?').length;
  if(typeof values[bindIndex]!=='string')throw Error('Missing scoring user');
  return [values[bindIndex] as string];
}

export class D1PreparedStatement {
  constructor(readonly owner:D1Database,readonly sql:string,readonly values:unknown[]=[]){}
  bind(...values:unknown[]){return new D1PreparedStatement(this.owner,this.sql,values);}
  async first<T=Row>():Promise<T|null>{return (await this.owner.execute(this)).rows[0] as T||null;}
  async all<T=Row>():Promise<{results:T[]}>{return {results:(await this.owner.execute(this)).rows as T[]};}
  async run(){const result=await this.owner.execute(this);return {success:true,meta:{changes:result.rowCount}};}
}
export class D1Database {
  constructor(readonly driver:Driver){}
  prepare(sql:string){return new D1PreparedStatement(this,sql);}
  async execute(statement:D1PreparedStatement):Promise<QueryResult>{
    const users=checkinUsers(statement.sql,statement.values);
    if(!users.length)return this.driver.query(compileSql(statement.sql),statement.values);
    return this.driver.transaction(async tx=>{
      await this.lockUsers(tx,users); // Separate statement BEFORE INSERT: fresh READ COMMITTED snapshot.
      return tx.query(compileSql(statement.sql),statement.values);
    });
  }
  private async lockUsers(tx:Executor,users:string[]){
    const locked=await tx.query('SELECT id FROM kampit.profiles WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE',[users]);
    if(locked.rows.length!==users.length)throw Error('Scoring profile not found');
    // Trigger rejects inserts outside this adapter transaction; raw imports use the explicit import script.
    await tx.query("SELECT set_config('kampit.scoring_lock','held',true)");
  }
  async batch(statements:D1PreparedStatement[]){
    if(statements.some(s=>s.owner!==this))throw Error('Database mismatch');
    return this.driver.transaction(async tx=>{
      const results=[];
      for(const statement of statements){
        const users=checkinUsers(statement.sql,statement.values);
        if(users.length)await this.lockUsers(tx,users);
        const r=await tx.query(compileSql(statement.sql),statement.values);
        results.push({success:true,results:r.rows,meta:{changes:r.rowCount}});
      }
      return results;
    });
  }
}
