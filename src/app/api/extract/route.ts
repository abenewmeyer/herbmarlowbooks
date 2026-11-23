import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { extractDocx, extractEpub, extractPdf } from "@/lib/extract";

export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { projectId } = await req.json();
  const { data: p } = await sb.from("projects").select("*").eq("id", projectId).single();
  if (!p?.manuscript_path) return NextResponse.json({ error: "No manuscript uploaded for this project." }, { status: 400 });
  try {
    const { data: file, error } = await sb.storage.from("manuscripts").download(p.manuscript_path);
    if (error || !file) throw new Error("Could not read the uploaded file: " + (error?.message ?? "unknown"));
    const buf = Buffer.from(await file.arrayBuffer());
    const head = buf.subarray(0, 5).toString("latin1");
    const isPdf = head.startsWith("%PDF");
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // docx is a zip
    const nm = (p.manuscript_name ?? "").toLowerCase();
    if (!isPdf && !isZip) throw new Error("That file is not a real PDF, Word (.docx) or EPUB file. Old .doc files are not supported - save as .docx or PDF.");
    if (isZip && !nm.endsWith(".docx") && !nm.endsWith(".epub")) throw new Error("Only .docx Word and .epub files are supported.");
    const ex = isPdf ? await extractPdf(new Uint8Array(buf)) : nm.endsWith(".epub") ? await extractEpub(buf) : await extractDocx(buf);
    await sb.from("chunks").delete().eq("project_id", p.id);
    for (let i = 0; i < ex.chunks.length; i += 40) {
      const rows = ex.chunks.slice(i, i + 40).map((c) => ({ project_id: p.id, seq: c.seq, locator: c.locator, body: c.body }));
      const { error: e } = await sb.from("chunks").insert(rows);
      if (e) throw new Error(e.message);
    }
    const extraction = { chunks: ex.chunks.length, pages: ex.pages ?? null, emptyPages: ex.emptyPages ?? 0, words: ex.words, at: new Date().toISOString() };
    await sb.from("projects").update({ extraction, stage: "analyze", brief: null, concepts: null, blurbs: null, marketing: null, updated_at: new Date().toISOString() }).eq("id", p.id);
    return NextResponse.json({ ok: true, extraction });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Extraction failed" }, { status: 422 });
  }
}
