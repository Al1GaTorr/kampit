// Private server configuration, shared by Next handlers and plain-Node scripts.
// Never import this module from a client component or log the resolved value.
export class DatabaseConfigurationError extends Error {
  constructor(){
    super('Configure DATABASE_URL or POSTGRES_URL with a valid PostgreSQL connection URI.');
    this.name='DatabaseConfigurationError';
  }
}

/** @param {Record<string,string|undefined>} [environment] */
export function resolveDatabaseUrl(environment=process.env){
  const explicit=environment.DATABASE_URL?.trim();
  const raw=explicit||environment.POSTGRES_URL?.trim();
  const invalid=()=>{throw new DatabaseConfigurationError();};
  if(!raw||/[\u0000-\u0020]/.test(raw))return invalid();
  let uri;
  try{
    uri=new URL(raw);
    // Validate credential encoding without decoding/re-encoding the returned URI.
    for(const component of [uri.username,uri.password]){
      const decoded=decodeURIComponent(component);
      if(/^(?:\[(?:YOUR[-_ ]PASSWORD|PROJECT[-_ ]REF)\]|<(?:YOUR[-_ ]PASSWORD|REDACTED)>|__REDACTED__)$/i.test(decoded))return invalid();
    }
  }catch{return invalid();} // Do not expose URL parser input/cause; it can contain a password.
  if(!['postgres:','postgresql:'].includes(uri.protocol)||!uri.hostname||uri.hash)return invalid();

  // These provider attribution keys are not PostgreSQL startup parameters:
  // Supabase's serverless-drivers guide documents workaround; Vercel Labs'
  // notebook-factory preserves pooled URLs while stripping provider-only supa.
  // Do not strip TLS, libpq options, or unrelated query values.
  const queryAt=raw.indexOf('?');
  if(queryAt<0)return raw;
  const parts=raw.slice(queryAt+1).split('&');
  const kept=parts.filter(part=>{
    let key;
    try{key=decodeURIComponent(part.split('=',1)[0].replaceAll('+',' '));}catch{return true;}
    return key!=='supa'&&key!=='workaround';
  });
  if(kept.length===parts.length)return raw;
  return raw.slice(0,queryAt)+(kept.length?'?'+kept.join('&'):'');
}
