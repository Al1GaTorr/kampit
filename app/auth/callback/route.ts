import { authClient } from '../../../lib/auth';
import { safeReturnTo } from '../../../lib/auth-security';
import { cookies } from 'next/headers';
import { publicOrigin, OriginSetupError } from '../../../lib/public-origin';
export const runtime='nodejs';
export async function GET(request:Request){
  let origin:string;
  try{origin=publicOrigin(request);}catch(error){return new Response('Kampit account setup is incomplete.',{status:error instanceof OriginSetupError?503:403});}
  const url=new URL(request.url),returnTo=safeReturnTo(url.searchParams.get('return_to'));
  const failure=new URL('/login',origin);failure.searchParams.set('return_to',returnTo);failure.searchParams.set('message','Confirmation could not finish. Request a new confirmation or sign in.');
  try{
    const code=url.searchParams.get('code');if(!code)return Response.redirect(failure,303);
    const client=await authClient();const {error}=await client.auth.exchangeCodeForSession(code);
    if(error)return Response.redirect(failure,303);
    const {data:{user},error:verifyError}=await client.auth.getUser();
    if(verifyError||!user)return Response.redirect(failure,303);
    (await cookies()).delete('kampit_demo');
    return Response.redirect(new URL(returnTo,origin),303);
  }catch{return Response.redirect(failure,303);}
}
