import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { groqJSON, RateLimited } from "@/lib/groq";
import { consume, refund } from "@/lib/quota";

export const maxDuration = 60;

const NO_INVENT = "Never invent characters, events, claims, credentials, awards, reviews or endorsements. If unsure, say so in the uncertainties field.";

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json();
  const { projectId, action } = body;
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const left = await consume(sb, "text");
  if (left < 0) return NextResponse.json({ error: "Daily text-AI limit reached. It resets at 00:00 UTC.", code: "quota" }, { status: 429 });
  try {
    const ctx = `Title: ${p.title}\nAuthor: ${p.author}\nGenre (author-stated): ${p.genre || "unknown"}\nLanguage: ${p.language}`;
    const vision = p.settings?.vision ? `\nAUTHOR'S VISION FOR THE COVER (follow as closely as honesty to the book allows): ${p.settings.vision}` : "";
    let out: any;

    if (action === "chunk") {
      const { data: c } = await sb.from("chunks").select("*").eq("project_id", projectId).eq("seq", body.seq).single();
      if (!c) throw new Error("Chunk not found");
      const words = Math.min(Math.max(Number(body.words) || 100, 40), 160);
      out = await groqJSON<{ summary: string }>(
        `You summarize one section of a manuscript. ${NO_INVENT} Write a factual summary of at most ${words} words, naming key people, places, events or arguments. JSON: {"summary": string}`,
        `${ctx}\nSection (${c.locator}):\n${c.body}`, 500);
      await sb.from("chunks").update({ summary: out.summary }).eq("id", c.id);
      return NextResponse.json({ ok: true, left });
    }

    const { data: chunks } = await sb.from("chunks").select("seq,locator,summary").eq("project_id", projectId).order("seq");
    const digest = (chunks ?? []).map((c) => `[${c.locator}] ${c.summary ?? "(not summarized)"}`).join("\n");

    if (action === "brief") {
      out = await groqJSON(
        `You are a publishing analyst building a book brief from section summaries. ${NO_INVENT} Include the ending in the synopsis for fiction/memoir (internal use). Cite locators like [pp. 1-12] in evidence. JSON shape:
{"form":"fiction|nonfiction|memoir|other","genre":string,"subgenres":string[],"logline":string,"synopsis":string(600-900 words),"themes":string[],"characters_or_subjects":[{"name":string,"role":string}],"setting_and_tone":string,"primary_audience":string,"secondary_audiences":string[],"visual_details":string[](exactly 5 concrete cover-inspiring details),"spoilers_to_avoid":string[],"evidence":string[],"uncertainties":string[]}`,
        `${ctx}\nSection summaries:\n${digest}`, 3200);
      await sb.from("projects").update({ brief: out, stage: "review", updated_at: new Date().toISOString() }).eq("id", projectId);
    } else {
      if (!p.brief) throw new Error("Create and review the book brief first.");
      const brief = JSON.stringify(p.brief);
      if (action === "concepts") {
        out = await groqJSON(
          `You are a book cover art director. Create exactly three DISTINCT front-cover concepts: A symbolic/minimalist, B atmospheric setting, C central object or character-led. Not recolors of one composition. No major spoilers, no named artists, no copying existing covers. Each image_prompt must be self-contained, portrait 2:3 artwork, include concrete details from the brief, leave clear uncluttered space for title and author, and request NO text, lettering, logos, watermark or mockup. JSON: {"concepts":[{"name":string,"support":string,"rationale":string,"palette":string,"composition":string,"title_placement":string,"image_prompt":string}]}`,
          `${ctx}${vision}\nApproved brief:\n${brief}`, 2200);
        if (!Array.isArray(out.concepts) || out.concepts.length < 3) throw new Error("The AI did not return three concepts. Try again.");
        out.concepts = out.concepts.slice(0, 3);
        await sb.from("projects").update({ concepts: out, updated_at: new Date().toISOString() }).eq("id", projectId);
      } else if (action === "blurbs") {
        out = await groqJSON(
          `You write back-cover blurbs. ${NO_INVENT} Three versions, each 120-180 words: A direct and commercial; B atmospheric and emotionally engaging; C concise and high-concept. Fiction: protagonist, conflict, stakes, tone - NO ending or late twists. Nonfiction: reader's problem, the book's approach, grounded benefits, no unsupported promises. Memoir: central experience and emotional stakes without sensationalizing real people. No awards, reviews, bestseller claims or comparisons to famous authors. JSON: {"versions":[{"label":string,"text":string}]}`,
          `${ctx}\nApproved brief:\n${brief}`, 1500);
        await sb.from("projects").update({ blurbs: out, updated_at: new Date().toISOString() }).eq("id", projectId);
      } else if (action === "revise_blurb") {
        out = await groqJSON(
          `You revise a back-cover blurb per the author's instruction. ${NO_INVENT} Keep 120-180 words unless told otherwise. No ending spoilers for fiction. JSON: {"text":string}`,
          `${ctx}\nBrief:\n${brief}\n\nCurrent blurb:\n${body.text}\n\nInstruction: ${body.instruction}`, 700);
      } else if (action === "marketing") {
        out = await groqJSON(
          `You are a book marketing strategist preparing intel for a marketing team, from the brief only. ${NO_INVENT} Category suggestions are SUGGESTIONS to be checked against the retailer's current category/BISAC lists. Comparable-title positioning is internal only (never put in the blurb). JSON:
{"tags":string[](15 short search tags),"keyword_phrases":string[](7 multi-word reader search phrases),"topics":string[],"category_suggestions":[{"label":string,"note":string}],"audiences":[{"segment":string,"why":string,"where_to_reach":string}],"hooks":string[](5),"taglines":string[](5 under 12 words),"social_angles":string[](5),"comparable_positioning":string[],"content_notes":string[],"caveats":string[]}`,
          `${ctx}\nApproved brief:\n${brief}`, 2200);
        await sb.from("projects").update({ marketing: out, updated_at: new Date().toISOString() }).eq("id", projectId);
      } else throw new Error("Unknown action");
    }
    return NextResponse.json({ ok: true, result: out, left });
  } catch (e: any) {
    await refund(sb, "text");
    if (e instanceof RateLimited) return NextResponse.json({ error: e.message, code: "rate", retryAfter: e.retryAfter }, { status: 429 });
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}
