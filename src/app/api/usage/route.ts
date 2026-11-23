import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { status } from "@/lib/quota";
export async function GET() {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await status(sb));
}
