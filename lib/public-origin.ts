// Never derive redirect/CSRF origins from untrusted forwarded headers or Next's
// internal bind URL (which can be http://0.0.0.0 in production).
export class OriginSetupError extends Error {}
export class OriginHostError extends Error {}
const loopback=(hostname:string)=>hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]';
export function publicOrigin(request:Request):string {
  let configured:URL;
  try{
    if(process.env.APP_ORIGIN){
      configured=new URL(process.env.APP_ORIGIN);
      if(configured.username||configured.password||configured.pathname!=='/'||configured.search||configured.hash||!['https:','http:'].includes(configured.protocol)||configured.protocol==='http:'&&!loopback(configured.hostname))throw Error('Invalid origin');
    }else{
      if(process.env.NODE_ENV==='production')throw Error('APP_ORIGIN required');
      const internal=new URL(request.url),host=request.headers.get('host')||internal.host;
      configured=new URL(`${internal.protocol}//${host}`);
      if(!loopback(configured.hostname))throw Error('Only local loopback hosts are allowed without APP_ORIGIN');
    }
  }catch{throw new OriginSetupError('Set APP_ORIGIN to the public HTTPS origin before publishing Kampit.');}
  const host=request.headers.get('host');
  if(host&&host.toLowerCase()!==configured.host.toLowerCase()){
    // Local-only aliases share one explicitly configured port. Forwarded hosts
    // are never used, including when they contain a loopback-looking value.
    try{const observed=new URL(`${configured.protocol}//${host}`);
      if(loopback(configured.hostname)&&loopback(observed.hostname)&&observed.port===configured.port&&observed.host.toLowerCase()===host.toLowerCase())return observed.origin;
    }catch{}
    throw new OriginHostError('This host is not configured for Kampit.');
  }
  return configured.origin;
}
