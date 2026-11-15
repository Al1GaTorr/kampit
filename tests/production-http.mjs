// Actual Next production process, no database/Auth credentials or mocked request URL.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import http from 'node:http';
const port=Number(process.env.KAMPIT_HTTP_TEST_PORT||3227),origin=`http://localhost:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',String(port)],{
  cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
  env:{...process.env,NODE_ENV:'production',APP_ORIGIN:origin,DATABASE_URL:'',POSTGRES_URL:'',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}
});
let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let checks=0;
// Node fetch can discard an explicit Host override. Raw HTTP proves which Host
// actually reaches Next when testing rejection, including malicious values.
function wireRequest(url,options={}){return new Promise((resolve,reject)=>{
  const request=http.request(url,{method:options.method||'GET',headers:options.headers},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:{get:name=>response.headers[name.toLowerCase()]},text:async()=>Buffer.concat(chunks).toString()}));
  });
  request.setTimeout(5000,()=>request.destroy(new Error('HTTP check timed out')));request.on('error',reject);request.end(options.body);
});}
async function check(path,options,status,extra){const response=await wireRequest(origin+path,options);const text=await response.text();assert.equal(response.status,status,`${path}: ${text}`);if(extra)extra(response,text);checks++;}
const form=(host='localhost',site=origin)=>({method:'POST',headers:{host:`${host}:${port}`,origin:site,'content-type':'application/x-www-form-urlencoded'},body:'email=fixture%40example.test&password=12345678&return_to=%2F%3Fjoin%3DABC'});
const json=(site=origin,headers={})=>({method:'POST',headers:{origin:site,'content-type':'application/json',...headers},body:'{"action":"demo"}'});
try{
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    if(server.exitCode!==null)throw Error('Next exited before readiness: '+output);
    try{await fetch(origin+'/login');ready=true;break;}catch{await pause(150);}
  }
  assert.ok(ready,'Next production server did not start');
  await check('/',{},200);
  await check('/login',{},200,(_,text)=>{assert.match(text,/Account sign-in is not available yet/);assert.ok(!text.includes('action="/api/auth/signup"'));});
  await check('/api/kampit',{},503);
  await check('/api/kampit',json(),503,(_,text)=>assert.match(text,/DATABASE_UNAVAILABLE/));
  const localIp=`http://127.0.0.1:${port}`;
  const ip=await wireRequest(localIp+'/api/kampit',json(localIp));assert.equal(ip.status,503);assert.match(await ip.text(),/DATABASE_UNAVAILABLE/);checks++;
  await check('/api/kampit',json('https://evil.test'),403);
  await check('/api/kampit',json(origin,{'x-forwarded-host':'evil.test','x-forwarded-proto':'https'}),503,(_,text)=>assert.match(text,/DATABASE_UNAVAILABLE/));
  await check('/api/auth/signin',form(),303,(response)=>{const location=new URL(response.headers.get('location'));assert.equal(location.origin,origin);assert.equal(location.searchParams.get('return_to'),'/?join=ABC');assert.match(location.searchParams.get('message'),/temporarily unavailable/);});
  await check('/api/auth/signin',form('localhost','https://evil.test'),403);
  await check('/api/auth/signin',{...form(),headers:{...form().headers,host:'evil.test'}},403);
  await check('/api/auth/signin',{...form(),headers:{...form().headers,'x-forwarded-host':'evil.test','x-forwarded-proto':'https'}},303,response=>assert.equal(new URL(response.headers.get('location')).origin,origin));
  await check('/auth/callback?return_to=%2F%3Fjoin%3DABC',{},303,response=>{const location=new URL(response.headers.get('location'));assert.equal(location.origin,origin);assert.equal(location.searchParams.get('return_to'),'/?join=ABC');});
  console.log(`PASS: ${checks} actual Next production HTTP checks, including localhost/127 Host+Origin, forwarded-host rejection, canonical redirects and honest missing setup.`);
}finally{server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),pause(3000)]);if(server.exitCode===null)server.kill('SIGKILL');}
