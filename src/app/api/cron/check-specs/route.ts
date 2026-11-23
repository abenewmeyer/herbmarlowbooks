import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { SOURCES } from "@/lib/specs";

export const maxDuration = 60;

async function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const { data } = await (await supabaseServer()).auth.getUser(); // "Check now" button for signed-in users
  return !!data.user;
}
const normalize = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function run(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = supabaseAdmin();
  const results: any[] = [];
  for (const s of SOURCES) {
    let status = "failed", hash: string | null = null, detail = "";
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(s.url, { signal: ctl.signal, headers: { "User-Agent": "herbmarlowbooks-spec-check/1.0" } }); clearTimeout(t);
      if (new URL(r.url).host !== s.host) { status = "inaccessible"; detail = "Redirected to a host outside the allowlist."; }
      else if (!r.ok) { status = "inaccessible"; detail = `HTTP ${r.status}`; }
      else {
        const text = normalize((await r.text()).slice(0, 2_000_000));
        if (text.length < 500) { status = "inaccessible"; detail = "Page returned too little readable text (may require JavaScript or sign-in)."; }
        else {
          hash = createHash("sha256").update(text).digest("hex");
          const { data: prev } = await admin.from("spec_checks").select("content_hash").eq("source_key", s.key).not("content_hash", "is", null).order("checked_at", { ascending: false }).limit(1);
          const last = prev?.[0]?.content_hash;
          status = !last ? "first_snapshot" : last === hash ? "unchanged" : "changed_needs_review";
          detail = status === "changed_needs_review" ? "Page text differs from the last snapshot. A person must compare it with the rules in this app. Rules were NOT changed automatically." : "";
        }
      }
    } catch (e: any) { status = "failed"; detail = String(e?.message || e).slice(0, 200); }
    await admin.from("spec_checks").insert({ source_key: s.key, source_url: s.url, status, content_hash: hash, detail });
    results.push({ source: s.key, status });
  }
  return NextResponse.json({ ok: true, results });
}
export const GET = run;
export const POST = run;
