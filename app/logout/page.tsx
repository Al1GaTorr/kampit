import { safeReturnTo } from '../../lib/auth-security';
export const dynamic='force-dynamic';
export default async function Logout({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const query=await searchParams;
  return <main style={{maxWidth:440,margin:'12vh auto',padding:28}}><h1>Sign out of Kampit?</h1><p>Your goals and saved practice will be here when you return.</p><form action="/api/auth/signout" method="post"><input type="hidden" name="return_to" value={safeReturnTo(query.return_to)}/><button className="btn btn-primary" type="submit">Sign out</button></form><a href="/">Keep learning</a></main>;
}
