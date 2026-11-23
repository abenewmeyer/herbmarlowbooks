import { NextResponse } from "next/server";
import { Client } from "@gradio/client";
import { supabaseServer } from "@/lib/supabase/server";
import { groqJSON } from "@/lib/groq";
import { consume, refund } from "@/lib/quota";

export const maxDuration = 60;
const SPACE = "black-forest-labs/FLUX.1-schnell"; // endpoint "/infer" read from the Space's public app.py on 2026-11-03; smoke-test after deploy
const SUFFIX = " Portrait 2:3 book cover artwork. Clear uncluttered space for a title and author name. No text, no lettering, no logos, no watermark, no book mockup.";

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { projectId, slot, note } = await req.json();
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).single();
  const concept = p?.concepts?.concepts?.[slot];
  if (!concept) return NextResponse.json({ error: "Create the three cover concepts first." }, { status: 400 });
  if (!process.env.HF_TOKEN) return NextResponse.json({ error: "HF_TOKEN is not set. Add it in Vercel, or upload your own artwork for this slot.", code: "manual" }, { status: 503 });

  const left = await consume(sb, "image");
  if (left < 0) return NextResponse.json({ error: "Daily image limit reached. It resets at 00:00 UTC. You can still upload your own artwork.", code: "quota" }, { status: 429 });
  try {
    let prompt: string = concept.image_prompt;
    const direction = [p.settings?.vision, note].filter(Boolean).join(" | ");
    if (direction) {
      const tleft = await consume(sb, "text");
      let revised: string | null = null;
      if (tleft >= 0) {
        try {
          const r = await groqJSON<{ prompt: string }>(
            "Revise an image-generation prompt for book-cover artwork to follow the author's direction while staying true to the original concept. Keep it self-contained, portrait 2:3, no text/lettering/logos. JSON: {\"prompt\":string}",
            `Original prompt:\n${prompt}\n\nAuthor direction: ${direction}`, 500);
          revised = r.prompt;
        } catch { await refund(sb, "text"); }
      }
      prompt = revised ?? `${prompt} Author direction: ${direction}.`;
    }
    const client = await Client.connect(SPACE, { token: process.env.HF_TOKEN as `hf_${string}` });
    const res: any = await client.predict("/infer", { prompt: prompt + SUFFIX, seed: 0, randomize_seed: true, width: 1024, height: 1536, num_inference_steps: 4 });
    const out = res.data?.[0]; const seed = res.data?.[1];
    const url: string | undefined = out?.url || out?.path;
    if (!url) throw new Error("The image service returned no image.");
    const host = new URL(url).hostname;
    const trusted = host.endsWith("hf.space") || host.endsWith("huggingface.co");
    const img = await fetch(url, { headers: trusted ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {} });
    if (!img.ok) throw new Error("Could not download the generated image.");
    const bytes = Buffer.from(await img.arrayBuffer());
    const ct = img.headers.get("content-type") || "image/webp";
    const ext = ct.includes("png") ? "png" : ct.includes("jpeg") ? "jpg" : "webp";
    const path = `${u.user.id}/${projectId}/cover-${slot}-${Date.now()}.${ext}`;
    const up = await sb.storage.from("covers").upload(path, bytes, { contentType: ct });
    if (up.error) throw new Error(up.error.message);
    const { data: row, error } = await sb.from("covers").insert({ project_id: projectId, slot, concept: concept.name, prompt, note: note || null, image_path: path, seed: typeof seed === "number" ? seed : null, source: "ai" }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, cover: row, left });
  } catch (e: any) {
    await refund(sb, "image");
    const msg = String(e?.message || e);
    const quota = /quota|ZeroGPU|exceeded/i.test(msg);
    return NextResponse.json({ error: quota ? "The free image service's own daily GPU allowance seems used up. Try later or upload your own artwork." : "Image generation failed: " + msg.slice(0, 200), code: quota ? "provider_quota" : "failed" }, { status: quota ? 429 : 502 });
  }
}
