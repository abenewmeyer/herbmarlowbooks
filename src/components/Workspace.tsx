"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import CoverStudio from "./CoverStudio";
import Marketing from "./Marketing";

type Q = { used: number; limit: number; remaining: number };
type Usage = { image: Q; text: Q; resetsAtUtc: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, body: any) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Request failed"), { code: j.code, retryAfter: j.retryAfter });
  return j;
}

export default function Workspace({ email }: { email: string }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [projects, setProjects] = useState<any[]>([]);
  const [pid, setPid] = useState<string>("");
  const [p, setP] = useState<any>(null);
  const [covers, setCovers] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<Usage | null>(null);
  const [pwOk, setPwOk] = useState(true);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState("");
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [newT, setNewT] = useState(""); const [newA, setNewA] = useState(""); const [newG, setNewG] = useState("");
  const [vision, setVision] = useState("");
  const [vIdx, setVIdx] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [slotErr, setSlotErr] = useState<Record<number, string>>({});
  const [slotBusy, setSlotBusy] = useState<Record<number, boolean>>({});
  const [ver, setVer] = useState(0); // blurb version tab
  const [blurbText, setBlurbText] = useState(""); const [instr, setInstr] = useState("");
  const [brief, setBrief] = useState<any>(null);
  const [bulk, setBulk] = useState<{ name: string; status: string }[]>([]);
  const [authorIn, setAuthorIn] = useState(""); const [search, setSearch] = useState(""); const [dragOver, setDragOver] = useState(false);

  const loadUsage = useCallback(async () => { const r = await fetch("/api/usage"); if (r.ok) setUsage(await r.json()); }, []);
  const loadProjects = useCallback(async () => {
    const { data } = await sb.from("projects").select("id,title,author,stage,created_at").order("created_at", { ascending: false });
    setProjects(data ?? []); return data ?? [];
  }, [sb]);
  const loadProject = useCallback(async (id: string) => {
    const { data } = await sb.from("projects").select("*").eq("id", id).single();
    setP(data); setVision(data?.settings?.vision ?? ""); setBrief(data?.brief ?? null); setBlurbText(data?.approved_blurb ?? data?.blurbs?.versions?.[0]?.text ?? "");
    const { data: cv } = await sb.from("covers").select("*").eq("project_id", id).order("created_at", { ascending: false });
    setCovers(cv ?? []);
    if (cv?.length) {
      const { data: signed } = await sb.storage.from("covers").createSignedUrls(cv.map((c: any) => c.image_path), 3600);
      const m: Record<string, string> = {}; signed?.forEach((s: any) => { if (s.path && s.signedUrl) m[s.path] = s.signedUrl; }); setUrls(m);
    }
  }, [sb]);

  useEffect(() => {
    (async () => {
      const list = await loadProjects(); if (list[0]) setPid(list[0].id);
      loadUsage();
      const { data: u } = await sb.auth.getUser();
      if (u.user) { const { data: f } = await sb.from("user_flags").select("pw_changed").eq("user_id", u.user.id).maybeSingle(); setPwOk(!!f?.pw_changed); }
    })();
  }, [sb, loadProjects, loadUsage]);
  useEffect(() => { if (pid) loadProject(pid); else setP(null); }, [pid, loadProject]);

  useEffect(() => { if (!authorIn && projects.find((x) => x.author)) setAuthorIn(projects.find((x) => x.author).author); }, [projects, authorIn]);
  const STAGES: Record<string, string> = { upload: "No file yet", analyze: "Ready to analyze", review: "Summary to review", vision: "Summary approved" };
  const nice = (n: string) => n.replace(/\.(pdf|docx|epub)$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  const shown = projects.filter((b) => !search.trim() || `${b.title} ${b.author}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function addBooks(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => /\.(pdf|docx|epub)$/i.test(f.name));
    if (!files.length) return fail("Choose PDF, Word (.docx) or EPUB files.");
    if (!consent) return fail("Please tick the rights box first.");
    setErr(""); setMsg(""); const { data: u } = await sb.auth.getUser(); let first = "";
    setBulk(files.map((f) => ({ name: f.name, status: "waiting" })));
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; const upd = (st: string) => setBulk((b) => b.map((x, j) => (j === i ? { ...x, status: st } : x)));
      try {
        if (f.size > 50 * 1024 * 1024) throw new Error("over 50 MB");
        upd("adding...");
        const { data: proj, error } = await sb.from("projects").insert({ title: nice(f.name), author: authorIn.trim() }).select().single();
        if (error) throw new Error(error.message);
        const ext = f.name.split(".").pop()!.toLowerCase(); const path = `${u.user!.id}/${proj.id}/manuscript.${ext}`;
        upd("uploading..."); const up = await sb.storage.from("manuscripts").upload(path, f, { upsert: true, contentType: f.type || undefined });
        if (up.error) throw new Error(up.error.message);
        await sb.from("projects").update({ manuscript_path: path, manuscript_name: f.name }).eq("id", proj.id);
        upd("reading..."); await api("/api/extract", { projectId: proj.id }); upd("ready to analyze"); if (!first) first = proj.id;
      } catch (e: any) { upd("FAILED: " + e.message); }
    }
    await loadProjects(); if (first) { setPid(first); say("Done. Open a book below and press Analyze. (Analysis runs one book at a time because the free AI is rate-limited.)"); }
  }

  const slots = [0, 1, 2].map((s) => covers.filter((c) => c.slot === s));
  const selected = covers.find((c) => c.selected);
  const stepNow = !p ? 0 : !p.extraction?.chunks ? 1 : !p.brief ? 2 : !p.concepts ? 3 : !selected || !p.approved_blurb ? 4 : 5;
  const stepNames = ["Upload", "Analyze", "Your vision", "Covers & blurb", "Design", "Export"];
  const say = (m: string) => { setMsg(m); setErr(""); }; const fail = (m: string) => { setErr(m); setMsg(""); };

  async function createProject() {
    if (!newT.trim()) return fail("Enter the book title first.");
    const { data, error } = await sb.from("projects").insert({ title: newT.trim(), author: newA.trim(), genre: newG.trim() }).select().single();
    if (error) return fail(error.message);
    setNewT(""); setNewA(""); setNewG(""); await loadProjects(); setPid(data.id); say("Project created. Next: upload the manuscript.");
  }
  async function deleteProject() {
    if (!p || !confirm(`Delete "${p.title}" and all of its files? This cannot be undone.`)) return;
    const { data: u } = await sb.auth.getUser(); const base = `${u.user!.id}/${p.id}`;
    for (const b of ["manuscripts", "covers"]) { const { data: files } = await sb.storage.from(b).list(base); if (files?.length) await sb.storage.from(b).remove(files.map((f: any) => `${base}/${f.name}`)); }
    await sb.from("projects").delete().eq("id", p.id); const list = await loadProjects(); setPid(list[0]?.id ?? ""); say("Project deleted.");
  }

  async function upload(file: File) {
    if (!p) return; if (!consent) return fail("Please tick the rights/AI-disclosure box first.");
    const ext = (file.name.toLowerCase().match(/\.(pdf|docx|epub)$/) || [])[1] || "";
    if (!ext) return fail("Please choose a PDF, Word .docx or EPUB file (not old .doc).");
    if (file.size > 50 * 1024 * 1024) return fail("File is over 50 MB.");
    setBusy("Uploading..."); setErr("");
    try {
      const { data: u } = await sb.auth.getUser(); const path = `${u.user!.id}/${p.id}/manuscript.${ext}`;
      const up = await sb.storage.from("manuscripts").upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (up.error) throw new Error(up.error.message);
      await sb.from("projects").update({ manuscript_path: path, manuscript_name: file.name }).eq("id", p.id);
      setBusy("Reading the manuscript..."); await api("/api/extract", { projectId: p.id });
      await loadProject(p.id); say("Manuscript read successfully.");
    } catch (e: any) { fail(e.message); } finally { setBusy(""); }
  }

  async function textCall(body: any) {
    for (let i = 0; i < 8; i++) {
      try { const r = await api("/api/analyze", { projectId: p.id, ...body }); loadUsage(); return r; }
      catch (e: any) {
        if (e.code === "rate") { const w = Math.min(Number(e.retryAfter) || 30, 90); for (let s = w; s > 0; s--) { setBusy(`Free AI is pacing itself - resuming in ${s}s (progress is saved)`); await sleep(1000); } continue; }
        throw e;
      }
    }
    throw new Error("The free text AI is still rate-limited. Wait a few minutes and press the button again; progress is saved.");
  }
  async function analyze() {
    setErr(""); try {
      const { data: ch } = await sb.from("chunks").select("seq,summary").eq("project_id", p.id).order("seq");
      const total = ch?.length ?? 0; const todo = (ch ?? []).filter((c: any) => !c.summary); const words = Math.round(Math.min(Math.max(3300 / Math.max(total, 1), 40), 140));
      for (let i = 0; i < todo.length; i++) { setProgress({ done: total - todo.length + i, total }); setBusy(`Reading section ${total - todo.length + i + 1} of ${total}...`); await textCall({ action: "chunk", seq: todo[i].seq, words }); }
      setProgress(null); setBusy("Writing the book brief..."); await textCall({ action: "brief" });
      await loadProject(p.id); say("Brief ready. Please read it against your book and correct anything wrong.");
    } catch (e: any) { fail(e.message); } finally { setBusy(""); setProgress(null); }
  }
  async function saveBrief(approve = false) {
    const { error } = await sb.from("projects").update({ brief, stage: approve ? "vision" : "review", updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return fail(error.message); await loadProject(p.id); say(approve ? "Brief approved." : "Brief saved.");
  }
  async function buildAll() {
    setErr(""); try {
      await sb.from("projects").update({ settings: { ...(p.settings ?? {}), vision }, brief }).eq("id", p.id); await loadProject(p.id);
      setBusy("Designing three cover concepts..."); await textCall({ action: "concepts" });
      setBusy("Writing back-cover blurbs..."); await textCall({ action: "blurbs" });
      setBusy("Preparing marketing intel..."); await textCall({ action: "marketing" });
      await loadProject(p.id); say("Concepts, blurbs and marketing intel are ready - see step 4.");
    } catch (e: any) { fail(e.message); } finally { setBusy(""); }
  }

  async function generate(slot: number) {
    setSlotBusy((s) => ({ ...s, [slot]: true })); setSlotErr((s) => ({ ...s, [slot]: "" }));
    try { await api("/api/cover", { projectId: p.id, slot, note: notes[slot] || undefined }); await loadProject(p.id); setVIdx((v) => ({ ...v, [slot]: 0 })); setNotes((n) => ({ ...n, [slot]: "" })); }
    catch (e: any) { setSlotErr((s) => ({ ...s, [slot]: e.message })); }
    finally { setSlotBusy((s) => ({ ...s, [slot]: false })); loadUsage(); }
  }
  async function generateAll() { for (const s of [0, 1, 2]) if (!slots[s].length) await generate(s); }
  async function manualUpload(slot: number, f: File) {
    if (!f.type.startsWith("image/")) return setSlotErr((s) => ({ ...s, [slot]: "Choose an image file." }));
    const { data: u } = await sb.auth.getUser(); const path = `${u.user!.id}/${p.id}/cover-${slot}-${Date.now()}-manual`;
    const up = await sb.storage.from("covers").upload(path, f, { contentType: f.type }); if (up.error) return setSlotErr((s) => ({ ...s, [slot]: up.error!.message }));
    await sb.from("covers").insert({ project_id: p.id, slot, concept: p.concepts?.concepts?.[slot]?.name ?? "Uploaded", image_path: path, source: "manual" }); await loadProject(p.id); setVIdx((v) => ({ ...v, [slot]: 0 }));
  }
  async function choose(id: string) {
    await sb.from("covers").update({ selected: false }).eq("project_id", p.id); await sb.from("covers").update({ selected: true }).eq("id", id); await loadProject(p.id);
  }
  const blurbs: any[] = p?.blurbs?.versions ?? [];
  async function rewrite() {
    if (!instr.trim()) return fail("Tell the AI what to change.");
    try { setBusy("Rewriting blurb..."); const r = await textCall({ action: "revise_blurb", text: blurbText, instruction: instr }); setBlurbText(r.result.text); setInstr(""); say("Rewritten - review it, then approve."); } catch (e: any) { fail(e.message); } finally { setBusy(""); }
  }
  async function approveBlurb() { await sb.from("projects").update({ approved_blurb: blurbText }).eq("id", p.id); await loadProject(p.id); say("Blurb approved."); }
  const imgQ = usage?.image; const imgOut = imgQ ? imgQ.remaining <= 0 : false;
  const resetLocal = usage ? new Date(usage.resetsAtUtc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <div className="wrap">
      <div className="top">
        <span className="brand">Herb Marlow Books &middot; Cover &amp; Blurb Studio</span>
        <div className="chips">
          {usage && <span className={`chip ${imgOut ? "bad" : usage.image.remaining <= 1 ? "warn" : ""}`} title={`Resets at 00:00 UTC (${resetLocal} your time)`}>Cover generations left today: <b>{usage.image.remaining}</b>/{usage.image.limit}</span>}
          {usage && <span className="chip" title="Text AI calls">Text AI calls left: {usage.text.remaining}/{usage.text.limit}</span>}
          <a className="chip" href="/start.html"><b>How to use</b></a><a className="chip" href="/guide">Guide</a><a className="chip" href="/account">Password</a>
          <a className="chip" href="#" onClick={async (e) => { e.preventDefault(); await sb.auth.signOut(); location.href = "/login"; }}>Sign out ({email})</a>
        </div>
      </div>

      {!pwOk && <div className="banner">You are using a temporary password. Please <a href="/account">change it now</a>.</div>}
      <ol className="steps">{stepNames.map((n, i) => <li key={n} className={i + 1 < stepNow ? "done" : i + 1 === stepNow ? "now" : ""}>{n}</li>)}</ol>
      {busy && <div className="banner">{busy}{progress && <div className="bar" style={{ marginTop: 8 }}><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}</div>}
      {err && <p className="err">{err}</p>}{msg && <p className="okc">{msg}</p>}

      <section className="card">
        <h2>Add your books</h2>
        <p className="muted">Drop one book or many. Each file becomes a book automatically (the title comes from the file name; you can fix it later). PDF, Word (.docx) or EPUB.</p>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "inherit" }}><input type="checkbox" style={{ width: "auto", marginTop: 5 }} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I own these books or have permission to process them. I understand their text is sent to a third-party free AI service (Groq) for analysis, and that free tiers may use submitted content under their own terms. Only short art prompts - not the manuscript - go to the image service.</span></label>
        <div style={{ height: 8 }} />
        <div className="row"><div style={{ flex: "0 1 320px" }}><label>Author name as printed on the covers</label><input value={authorIn} onChange={(e) => setAuthorIn(e.target.value)} placeholder="e.g. Herb Marlow" /></div></div>
        <label className={`drop ${dragOver ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); addBooks(e.dataTransfer.files); }}>
          <b>Drop your book files here</b><span className="muted"> or click to choose (you can select many)</span>
          <input type="file" multiple accept=".pdf,.docx,.epub" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) addBooks(e.target.files); e.target.value = ""; }} />
        </label>
        {bulk.length > 0 && <div style={{ marginTop: 10 }}>{bulk.map((x, i) => <div key={i} className="muted"><b>{x.name}</b> - <span className={x.status.startsWith("FAILED") ? "err" : x.status.startsWith("ready") ? "okc" : ""}>{x.status}</span></div>)}</div>}
      </section>

      <section className="card">
        <h2>Your books ({projects.length})</h2>
        <input placeholder="Search by title..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="lib">
          {shown.slice(0, 120).map((b) => (
            <div key={b.id} className={`libRow ${b.id === pid ? "sel" : ""}`} onClick={() => setPid(b.id)}>
              <div><b>{b.title}</b> <span className="muted">{b.author}</span></div><span className="chip">{STAGES[b.stage] ?? b.stage}</span>
            </div>))}
          {!projects.length && <p className="muted">No books yet - drop your first file above.</p>}
          {projects.length > 0 && !shown.length && <p className="muted">No match.</p>}
        </div>
        {p && (<div className="row" style={{ marginTop: 12 }}>
          <div><label>Title of the open book (shown on the cover)</label><input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} onBlur={async () => { await sb.from("projects").update({ title: p.title }).eq("id", p.id); loadProjects(); }} /></div>
          <div><label>Author</label><input value={p.author} onChange={(e) => setP({ ...p, author: e.target.value })} onBlur={async () => { await sb.from("projects").update({ author: p.author }).eq("id", p.id); loadProjects(); }} /></div>
          <div style={{ flex: "0 0 auto" }}><button className="ghost small" onClick={deleteProject}>Delete this book</button></div>
        </div>)}
        <details style={{ marginTop: 10 }}><summary className="muted">Create a book without a file</summary>
          <div className="row" style={{ marginTop: 8 }}><div><label>Title</label><input value={newT} onChange={(e) => setNewT(e.target.value)} /></div><div><label>Author</label><input value={newA} onChange={(e) => setNewA(e.target.value)} /></div><div><label>Genre (optional)</label><input value={newG} onChange={(e) => setNewG(e.target.value)} /></div><div style={{ flex: "0 0 auto" }}><button onClick={createProject}>Create</button></div></div>
        </details>
      </section>

      {p && (<>
        <section className="card">
          <h2>1. Manuscript for this book</h2>
          <p className="muted">Already added above. Use this only to replace this book's file. PDF (real text, not scans), Word .docx or EPUB, up to 50 MB.</p>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "inherit" }}><input type="checkbox" style={{ width: "auto", marginTop: 5 }} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I own this manuscript or have permission to process it. I understand its text is sent to a third-party free AI service (Groq) for analysis, and that free tiers may use submitted content under their own terms. Only short art prompts - not the manuscript - go to the image service.</span></label>
          <div style={{ height: 8 }} />
          <input type="file" accept=".pdf,.docx,.epub" disabled={!!busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {p.extraction?.chunks > 0 && <p className="okc">{p.manuscript_name}: {p.extraction.chunks} sections read, about {p.extraction.words?.toLocaleString()} words{p.extraction.pages ? `, ${p.extraction.pages} pages` : ""}.</p>}
        </section>

        {p.extraction?.chunks > 0 && (
          <section className="card">
            <h2>2. Analyze &amp; review the brief</h2>
            <p className="muted">Free AI reads in small pieces, so a full book can take 10-15 minutes. Keep this tab open; it pauses and resumes by itself.</p>
            <button onClick={analyze} disabled={!!busy}>{p.brief ? "Re-run analysis" : "Analyze manuscript"}</button>
            {brief && (<div style={{ marginTop: 16 }}>
              <div className="row">
                <div><label>Form / genre</label><input value={`${brief.form ?? ""} / ${brief.genre ?? ""}`} readOnly /></div>
                <div><label>Primary audience</label><input value={brief.primary_audience ?? ""} onChange={(e) => setBrief({ ...brief, primary_audience: e.target.value })} /></div>
              </div>
              <label style={{ marginTop: 10 }}>One-line summary</label><input value={brief.logline ?? ""} onChange={(e) => setBrief({ ...brief, logline: e.target.value })} />
              <label style={{ marginTop: 10 }}>Synopsis (internal; fiction includes the ending)</label><textarea style={{ minHeight: 220 }} value={brief.synopsis ?? ""} onChange={(e) => setBrief({ ...brief, synopsis: e.target.value })} />
              <label style={{ marginTop: 10 }}>Themes (comma-separated)</label><input value={(brief.themes ?? []).join(", ")} onChange={(e) => setBrief({ ...brief, themes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <label style={{ marginTop: 10 }}>Setting &amp; tone</label><input value={brief.setting_and_tone ?? ""} onChange={(e) => setBrief({ ...brief, setting_and_tone: e.target.value })} />
              <label style={{ marginTop: 10 }}>Visual details for the cover (one per line)</label><textarea value={(brief.visual_details ?? []).join("\n")} onChange={(e) => setBrief({ ...brief, visual_details: e.target.value.split("\n").filter(Boolean) })} />
              {(brief.uncertainties?.length > 0) && <p className="muted"><b>The AI was unsure about:</b> {brief.uncertainties.join("; ")}</p>}
              <div className="row" style={{ marginTop: 10 }}><div style={{ flex: "0 0 auto" }}><button className="ghost" onClick={() => saveBrief(false)}>Save corrections</button></div><div style={{ flex: "0 0 auto" }}><button onClick={() => saveBrief(true)}>Approve brief</button></div></div>
            </div>)}
          </section>
        )}

        {p.brief && (
          <section className="card">
            <h2>3. Your vision for the new cover</h2>
            <p className="muted">Describe what you picture - mood, colors, objects, setting. The AI will stay true to the book but follow this as closely as it can. You can change this later and regenerate.</p>
            <textarea value={vision} onChange={(e) => setVision(e.target.value)} placeholder="e.g. A lone lighthouse at dusk, deep teal and amber, calm but a little haunting. No people." />
            <div style={{ height: 8 }} /><button onClick={buildAll} disabled={!!busy}>{p.concepts ? "Rebuild concepts, blurbs & marketing intel" : "Create cover concepts, blurbs & marketing intel"}</button>
          </section>
        )}

        {p.concepts && (
          <section className="card">
            <h2>4. Pick a cover and a back-cover blurb</h2>
            <div className="chips" style={{ marginBottom: 10 }}>
              {usage && <span className={`chip ${imgOut ? "bad" : usage.image.remaining <= 1 ? "warn" : ""}`}>Regenerations left today: <b>{usage.image.remaining}</b> of {usage.image.limit}</span>}
              <span className="chip muted">Counter resets 00:00 UTC ({resetLocal} your time). It is a safety guard for the shared free image account.</span>
              <button className="small" disabled={imgOut || !!busy || [0, 1, 2].some((s) => slotBusy[s]) || slots.every((s) => s.length > 0)} onClick={generateAll}>Generate the 3 covers</button>
            </div>
            <div className="split">
              <div>
                <h3>Back-cover blurb</h3>
                <div className="chips" style={{ marginBottom: 8 }}>{blurbs.map((b, i) => <button key={i} className={`small ${ver === i ? "" : "ghost"}`} onClick={() => { setVer(i); setBlurbText(b.text); }}>{b.label || `Version ${"ABC"[i]}`}</button>)}</div>
                <textarea style={{ minHeight: 280 }} value={blurbText} onChange={(e) => setBlurbText(e.target.value)} />
                <p className="muted">{blurbText.trim().split(/\s+/).filter(Boolean).length} words</p>
                <label>Ask for a rewrite</label><input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="e.g. warmer tone, shorter, mention the setting" />
                <div className="row" style={{ marginTop: 8 }}><div style={{ flex: "0 0 auto" }}><button className="ghost small" onClick={rewrite} disabled={!!busy}>Rewrite</button></div><div style={{ flex: "0 0 auto" }}><button className="small" onClick={approveBlurb}>Approve this blurb</button></div></div>
                {p.approved_blurb && <p className="okc">Approved blurb saved.</p>}
              </div>
              <div>
                <h3>Three cover options</h3>
                <div className="covers">
                  {[0, 1, 2].map((s) => { const vs = slots[s]; const i = Math.min(vIdx[s] ?? 0, Math.max(vs.length - 1, 0)); const c = vs[i]; const con = p.concepts.concepts?.[s];
                    return (
                      <div key={s} className={`cv ${c?.selected ? "sel" : ""}`}>
                        <div className="img">{slotBusy[s] ? "Generating... up to a minute" : c && urls[c.image_path] ? <img src={urls[c.image_path]} alt={con?.name} /> : "Not generated yet"}</div>
                        <b style={{ fontSize: ".9rem" }}>{"ABC"[s]}. {con?.name}</b>
                        <div className="muted" style={{ fontSize: ".8rem" }}>{con?.composition?.slice(0, 110)}</div>
                        {vs.length > 1 && <div className="muted" style={{ fontSize: ".8rem" }}><a href="#" onClick={(e) => { e.preventDefault(); setVIdx((v) => ({ ...v, [s]: Math.min(i + 1, vs.length - 1) })); }}>&lsaquo; older</a> version {vs.length - i} of {vs.length} <a href="#" onClick={(e) => { e.preventDefault(); setVIdx((v) => ({ ...v, [s]: Math.max(i - 1, 0) })); }}>newer &rsaquo;</a></div>}
                        {c && <button className={`small ${c.selected ? "" : "ghost"}`} style={{ margin: "6px 0" }} onClick={() => choose(c.id)}>{c.selected ? "Selected" : "Use this cover"}</button>}
                        <input style={{ fontSize: ".85rem" }} placeholder="What should change? (optional)" value={notes[s] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [s]: e.target.value }))} />
                        <button className="small" style={{ marginTop: 6, width: "100%" }} disabled={imgOut || slotBusy[s] || !!busy} onClick={() => generate(s)}>{c ? "Regenerate closer to my idea" : "Generate"}</button>
                        <label style={{ marginTop: 6 }}>or upload your own art</label><input type="file" accept="image/*" style={{ fontSize: ".75rem" }} onChange={(e) => e.target.files?.[0] && manualUpload(s, e.target.files[0])} />
                        {slotErr[s] && <p className="err" style={{ fontSize: ".8rem" }}>{slotErr[s]}</p>}
                      </div>); })}
                </div>
                {imgOut && <p className="err">Today's free image allowance is used up. Upload your own art or come back after the reset.</p>}
                <details style={{ marginTop: 10 }}><summary className="muted">Why these three concepts?</summary>{p.concepts.concepts?.map((c: any, i: number) => <p key={i} className="muted"><b>{"ABC"[i]}. {c.name}:</b> {c.rationale}</p>)}</details>
              </div>
            </div>
          </section>
        )}

        {selected && urls[selected.image_path] && (
          <CoverStudio project={p} imageUrl={urls[selected.image_path]} coverId={selected.id} onChooseCover={choose} />
        )}
        {p.marketing && <Marketing m={p.marketing} brief={p.brief} />}
      </>)}
    </div>
  );
}
