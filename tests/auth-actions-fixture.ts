// Local test interfaces only. No Supabase/Next network, sessions or settings.
type FixtureUser={id:string;email:string};
type Scenario={session:Record<string,unknown>|null;signupError:boolean;user:FixtureUser|null;verifyError:boolean;verifyThrows:boolean};
let scenario:Scenario;
export const calls:string[]=[];
export const deletedCookies:string[]=[];
export const signupInputs:Array<{email:string;password:string;options:{emailRedirectTo:string}}>=[];
export function reset(overrides:Partial<Scenario>={}){
  scenario={session:null,signupError:false,user:null,verifyError:false,verifyThrows:false,...overrides};
  calls.length=0;deletedCookies.length=0;signupInputs.length=0;
}
export async function cookies(){return {delete(name:string){calls.push('delete-cookie');deletedCookies.push(name);}};}
export async function authClient(){
  calls.push('authClient');
  return {auth:{
    async signUp(input:{email:string;password:string;options:{emailRedirectTo:string}}){
      calls.push('signUp');signupInputs.push(input);
      return {data:{session:scenario.session,user:{id:'untrusted-signup-user'}},error:scenario.signupError?{message:'Fixture signup rejected'}:null};
    },
    async getUser(){
      calls.push('getUser');if(scenario.verifyThrows)throw new Error('Fixture Auth service unavailable');
      return {data:{user:scenario.user},error:scenario.verifyError?{message:'Fixture verification rejected'}:null};
    },
    async getSession(){throw new Error('The handler must not authorize using getSession');}
  }};
}
