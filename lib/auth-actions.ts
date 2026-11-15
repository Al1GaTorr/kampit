import { cookies } from 'next/headers';
import { authClient } from './auth';
import { sameOriginForm, safeReturnTo } from './auth-security';
import { publicOrigin, OriginSetupError } from './public-origin';

export async function authAction(request:Request,action:'signin'|'signup'|'signout'):Promise<Response>{
  try{sameOriginForm(request);}catch(error){return new Response(error instanceof OriginSetupError?'Kampit account setup is incomplete. Please try again shortly.':'Submit this form from Kampit.',{status:error instanceof OriginSetupError?503:403});}
  const raw=await request.text();if(raw.length>16384)return new Response('Form too large.',{status:413});
  // Forms are intentionally URL encoded; reject unsupported multipart bodies here.
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Unsupported form.',{status:415});
  const form=new URLSearchParams(raw),returnTo=safeReturnTo(form.get('return_to'));
  const origin=publicOrigin(request);
  const go=(path:string)=>Response.redirect(new URL(path,origin),303);
  const failed=(message:string)=>go(`/login?return_to=${encodeURIComponent(returnTo)}&message=${encodeURIComponent(message)}`);
  try{
    const client=await authClient();
    if(action==='signout'){
      const {error}=await client.auth.signOut();if(error)return failed('Sign out could not finish. Please try again.');
      (await cookies()).delete('kampit_demo');return go(returnTo);
    }
    const email=(form.get('email')||'').trim(),password=form.get('password')||'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<8||password.length>128)return failed('Enter a valid email and a password of 8–128 characters.');
    if(action==='signin'){
      const {error}=await client.auth.signInWithPassword({email,password});
      if(error)return failed('Sign in failed. Check your details and email confirmation, then try again.');
      const {data:{user},error:verifyError}=await client.auth.getUser();
      if(verifyError||!user)return failed('Your session could not be verified. Please try again.');
      (await cookies()).delete('kampit_demo');return go(returnTo);
    }
    const callback=new URL('/auth/callback',origin);callback.searchParams.set('return_to',returnTo);
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:callback.toString()}});
    if(error)return failed('Sign up could not finish. Please try again or sign in to an existing account.');
    if(data.session){
      const {data:{user},error:verifyError}=await client.auth.getUser();
      if(verifyError||!user)return failed('Your session could not be verified. Please try again.');
      (await cookies()).delete('kampit_demo');return go(returnTo);
    }
    return failed('Check your email to confirm your account, then return here to sign in.');
  }catch{return failed('Account service is temporarily unavailable. Please try again shortly.');}
}
