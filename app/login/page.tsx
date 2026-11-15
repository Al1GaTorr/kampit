import { safeReturnTo } from '../../lib/auth-security';
import { authConfigured } from '../../lib/auth';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=await searchParams,returnTo=safeReturnTo(query.return_to),message=typeof query.message==='string'?query.message.slice(0,400):'';
  if(!authConfigured())return <main style={{maxWidth:460,margin:'8vh auto',padding:28,background:'white',borderRadius:20}}><a href="/">Kampit</a><h1>Account sign-in is not available yet.</h1><p role="status">This site’s account service is still being configured. You can return to Kampit and use the clearly labeled demo when storage is available. Your account data has not been changed.</p><a href={returnTo}>Back to Kampit</a></main>;
  return <main style={{maxWidth:460,margin:'8vh auto',padding:28,background:'white',borderRadius:20}}>
    <a href="/" className="brand">Kampit</a><h1>Build your momentum.</h1><p>Sign in with your email to keep your goals, practice and friend competitions.</p>
    {message&&<p role="status" style={{padding:14,background:'#f0edff',borderRadius:8}}>{message}</p>}
    <form action="/api/auth/signin" method="post" style={{display:'grid',gap:16}}>
      <input type="hidden" name="return_to" value={returnTo}/>
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} style={{display:'block',width:'100%',padding:12}}/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} style={{display:'block',width:'100%',padding:12}}/></label>
      <button className="btn btn-primary" type="submit">Sign in</button>
      <button className="btn btn-secondary" type="submit" formAction="/api/auth/signup">Create account</button>
    </form><p style={{marginTop:20}}>Create an account to keep your goals and saved practice. We’ll guide you through any next steps.</p><a href={returnTo}>Back to Kampit</a>
  </main>;
}
