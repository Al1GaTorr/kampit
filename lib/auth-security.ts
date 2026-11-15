export function safeReturnTo(value:unknown):string {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return '/';
  try{const url=new URL(value,'https://kampit.local');
    if(url.origin!=='https://kampit.local'||/^\/(?:login|logout|api\/auth|auth\/callback)(?:\/|$)/.test(url.pathname))return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  }catch{return '/';}
}
export function sameOriginForm(request:Request):void {
  if(request.headers.get('origin')!==publicOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')throw new Error('CROSS_ORIGIN');
  if(!/^(application\/x-www-form-urlencoded|multipart\/form-data)(?:;|$)/i.test(request.headers.get('content-type')||''))throw new Error('FORM_REQUIRED');
  const length=Number(request.headers.get('content-length')||0);if(length>16384)throw new Error('FORM_TOO_LARGE');
}
import { publicOrigin } from './public-origin';
