import postgres from 'postgres';
import { D1Database, type Driver, type Executor } from './pg-adapter';
import { resolveDatabaseUrl } from './deployment-env.mjs';

let instance:D1Database|undefined;
export function database():D1Database {
  if(instance)return instance;
  const url=resolveDatabaseUrl();
  // Module-scope client; Supabase transaction pooler, TLS, no prepared statements.
  const sql=postgres(url,{max:1,prepare:false,ssl:'require',connect_timeout:10,idle_timeout:20,max_lifetime:60*5,
    onnotice:()=>{} });
  const executor=(client:typeof sql):Executor=>({
    async query(text,values=[]){const result=await client.unsafe(text,values as never[]);return {rows:Array.from(result),rowCount:result.count};}
  });
  const driver:Driver={
    async query(text,values=[]){return sql.begin(async tx=>{
      await tx.unsafe("SET LOCAL statement_timeout = '12s'");
      return executor(tx as unknown as typeof sql).query(text,values);
    }) as Promise<any>;},
    async transaction(callback){return sql.begin(async tx=>{
      await tx.unsafe("SET LOCAL statement_timeout = '12s'");
      await tx.unsafe("SET LOCAL lock_timeout = '5s'");
      return callback(executor(tx as unknown as typeof sql));
    }) as Promise<any>;}
  };
  instance=new D1Database(driver);return instance;
}
