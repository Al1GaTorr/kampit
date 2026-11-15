import type { D1Database } from '../lib/pg-adapter';
export let pg:D1Database;
export let user:{userId:string,email:string,fullName:null}|null=null;
export function setDatabase(value:D1Database){pg=value;}
export function setUser(id:string|null){user=id?{userId:id,email:`${id}@example.test`,fullName:null}:null;}
export function database(){return pg;}
// TEST ONLY: simulated already-verified identity; no claim this tests Supabase network auth.
export async function getVerifiedUser(){return user;}
export async function resolveProfileId(id:string){return `supabase:${id}`;}
