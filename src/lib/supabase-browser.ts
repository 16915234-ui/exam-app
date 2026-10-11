import { createClient } from "@supabase/supabase-js";
let browserClient:ReturnType<typeof createClient>|null=null;
export async function supabaseBrowser(){if(browserClient)return browserClient;const response=await fetch("/api/auth/config");const config=await response.json();if(!response.ok)throw new Error(config.error??"Supabase config is unavailable.");browserClient=createClient(config.url,config.publishableKey);return browserClient}
