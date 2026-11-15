import { authAction } from '../../../../lib/auth-actions';
export const runtime='nodejs';
export const POST=(request:Request)=>authAction(request,'signout');
