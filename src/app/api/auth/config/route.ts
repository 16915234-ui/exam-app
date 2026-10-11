import { NextResponse } from "next/server";
export async function GET(){const url=process.env.SUPABASE_URL;const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;if(!url||!publishableKey)return NextResponse.json({error:"Supabase public configuration is missing."},{status:503});return NextResponse.json({url,publishableKey})}
