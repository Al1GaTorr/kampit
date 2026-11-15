import assert from 'node:assert/strict';
import { readFile,writeFile,unlink } from 'node:fs/promises';
import { reset,calls,deletedCookies,signupInputs } from './auth-actions-fixture';
const temporary=new URL('./.runtime-auth-actions.ts',import.meta.url);
const previousOrigin=process.env.APP_ORIGIN;
process.env.APP_ORIGIN='https://kampit.example';
let groups=0;
const pass=(name:string)=>{groups++;console.log(`PASS auth ${groups}: ${name}`);};
try{
  // Execute the actual production handler; replace only its SDK/Next interfaces.
  const source=(await readFile(new URL('../lib/auth-actions.ts',import.meta.url),'utf8'))
    .replace("from 'next/headers'","from './auth-actions-fixture'")
    .replace("from './auth'","from './auth-actions-fixture'")
    .replace("from './auth-security'","from '../lib/auth-security'")
    .replace("from './public-origin'","from '../lib/public-origin'");
  await writeFile(temporary,source);
  const {authAction}=await import(temporary.href+'?version='+Date.now());
  const request=(returnTo='/?join=FRIEND42',headers:Record<string,string>={})=>new Request('http://0.0.0.0:3000/api/auth/signup',{
    method:'POST',headers:{host:'kampit.example',origin:'https://kampit.example','content-type':'application/x-www-form-urlencoded',...headers},
    body:new URLSearchParams({email:'fixture@example.test',password:'fixture-password',return_to:returnTo})
  });
  const location=(response:Response)=>{assert.equal(response.status,303);return new URL(response.headers.get('location')!);};
  const verified={id:'authoritative-user',email:'fixture@example.test'};
  const untrustedSession={access_token:'fixture-only-token',user:{id:'untrusted-session-user',email:'untrusted@example.test'}};

  reset({session:untrustedSession,user:verified});
  const immediate=location(await authAction(request(),'signup'));
  assert.equal(immediate.href,'https://kampit.example/?join=FRIEND42');
  assert.deepEqual(calls,['authClient','signUp','getUser','delete-cookie']);
  assert.deepEqual(deletedCookies,['kampit_demo']);
  const callback=new URL(signupInputs[0].options.emailRedirectTo);
  assert.equal(callback.origin,'https://kampit.example');assert.equal(callback.pathname,'/auth/callback');assert.equal(callback.searchParams.get('return_to'),'/?join=FRIEND42');
  pass('Immediate signup session requires authoritative getUser, clears demo and preserves local invite');

  reset({session:untrustedSession,user:verified,verifyError:true});
  const rejected=location(await authAction(request(),'signup'));
  assert.equal(rejected.pathname,'/login');assert.match(rejected.searchParams.get('message')!,/could not be verified/);
  assert.ok(calls.includes('getUser'));assert.deepEqual(deletedCookies,[]);
  pass('A session object and user do not bypass a verification error');

  reset({session:untrustedSession,user:null});
  const noUser=location(await authAction(request(),'signup'));
  assert.equal(noUser.pathname,'/login');assert.match(noUser.searchParams.get('message')!,/could not be verified/);assert.deepEqual(deletedCookies,[]);
  pass('Immediate session without authoritative user is not a successful login');

  reset({session:untrustedSession,user:verified,verifyThrows:true});
  const unavailable=location(await authAction(request(),'signup'));
  assert.equal(unavailable.pathname,'/login');assert.match(unavailable.searchParams.get('message')!,/temporarily unavailable/);assert.deepEqual(deletedCookies,[]);
  pass('Auth verification service failure does not clear demo or signal signup success');

  reset({session:null,user:verified});
  const pending=location(await authAction(request(),'signup'));
  assert.equal(pending.pathname,'/login');assert.match(pending.searchParams.get('message')!,/Check your email/);assert.equal(pending.searchParams.get('return_to'),'/?join=FRIEND42');
  assert.deepEqual(calls,['authClient','signUp']);assert.deepEqual(deletedCookies,[]);
  pass('No signup session follows the email-confirmation next step without trusting signup user');

  reset({session:untrustedSession,user:verified,signupError:true});
  const signupFailure=location(await authAction(request(),'signup'));
  assert.equal(signupFailure.pathname,'/login');assert.match(signupFailure.searchParams.get('message')!,/Sign up could not finish/);
  assert.deepEqual(calls,['authClient','signUp']);assert.deepEqual(deletedCookies,[]);
  pass('Signup error takes precedence over any returned session');

  for(const unsafe of ['https://evil.example/','//evil.example','/\\evil.example','/api/auth/signout']){
    reset({session:untrustedSession,user:verified});
    assert.equal(location(await authAction(request(unsafe),'signup')).href,'https://kampit.example/');
  }
  pass('External and reserved return targets cannot redirect away from Kampit');

  const rejectedHeaders:Record<string,string>[]=[{origin:'https://evil.example'},{origin:''},{'sec-fetch-site':'cross-site'},{host:'evil.example'}];
  for(const headers of rejectedHeaders){
    reset({session:untrustedSession,user:verified});
    const denied=await authAction(request('/?join=FRIEND42',headers),'signup');assert.equal(denied.status,403);assert.deepEqual(calls,[]);assert.deepEqual(deletedCookies,[]);
  }
  pass('Cross-origin, missing Origin, cross-site and forged Host stop before SDK calls');
  console.log(`PASS: ${groups} real-handler auth fixture groups. No live Auth call or email-confirmation setting change.`);
}finally{
  await unlink(temporary).catch(()=>{});
  if(previousOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previousOrigin;
}
