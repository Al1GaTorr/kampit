import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function authConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&(process.env.NODE_ENV!=='production'||process.env.APP_ORIGIN));}
export async function authClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Supabase Auth is not configured');
  const jar=await cookies();
  return createServerClient(url,key,{
    global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10000)})},
    cookieOptions:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'},
    cookies:{getAll:()=>jar.getAll(),setAll:items=>{
      // This helper runs only in Route Handlers, where cookie refresh is supported.
      for(const {name,value,options} of items)jar.set(name,value,{...options,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});
    }}
  });
}
export async function getVerifiedUser(){
  if(!authConfigured())return null; // Guest demo remains usable; login explains setup failure.
  const client=await authClient();
  // Authoritative Auth server verification. Never authorize via getSession or request headers.
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||!user.email)return null;
  return {userId:user.id,email:user.email,fullName:null,displayName:user.email.split('@')[0]};
}
