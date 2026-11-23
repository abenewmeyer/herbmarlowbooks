import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // always read the live environment, never a build-time snapshot

// Reports which settings are present (true/false only - never values) and catches the most common key mix-ups.
function jwtRole(k?: string): string | null {
  try { const p = k?.split(".")[1]; return p ? JSON.parse(Buffer.from(p, "base64url").toString()).role ?? null : null; } catch { return null; }
}
export async function GET() {
  const e = process.env;
  const dyn = (k: string) => process.env[k];
  const anon = dyn("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const problems: string[] = [];
  if (anon?.startsWith("sb_secret_") || jwtRole(anon) === "service_role") problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a SECRET key. Put the publishable key there, and rotate the secret key in Supabase.");
  const url = dyn("NEXT_PUBLIC_SUPABASE_URL");
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) problems.push("NEXT_PUBLIC_SUPABASE_URL does not look like https://<project>.supabase.co");
  if (e.HF_TOKEN && !e.HF_TOKEN.startsWith("hf_")) problems.push("HF_TOKEN should start with hf_");
  if (e.CRON_SECRET && e.CRON_SECRET.length < 16) problems.push("CRON_SECRET is too short (use 32+ characters)");
  const set = (k: string) => !!dyn(k);
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GROQ_API_KEY", "HF_TOKEN", "CRON_SECRET"];
  const missing = required.filter((k) => !set(k));
  return NextResponse.json({ ok: !missing.length && !problems.length, missing, problems, set: Object.fromEntries(required.map((k) => [k, set(k)])) });
}
