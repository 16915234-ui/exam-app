import { createClient, type User } from "@supabase/supabase-js";
export async function requireAdmin(request:Request):Promise<{user:User;db:any}|null>{const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!token||!url||!key)return null;const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.auth.getUser(token);if(error||!data.user)return null;return{user:data.user,db}}

