import { database } from './database';
// New Supabase UUIDs have their own namespace. Legacy Sites IDs are never
// automatically claimed by matching display names, arbitrary headers or email input.
export async function resolveProfileId(supabaseUserId:string):Promise<string>{
  const link=await database().prepare('SELECT profile_id FROM identity_links WHERE supabase_user_id=?').bind(supabaseUserId).first<{profile_id:string}>();
  return link?.profile_id||`supabase:${supabaseUserId}`;
}
