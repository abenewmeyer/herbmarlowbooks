"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Check, Design, PrintCfg, kdpSpine, renderEbook, renderWrap, toBlob, validate, wrapToPdf } from "@/lib/cover";
import { INGRAM_PRINT, KDP_EBOOK, KDP_PAPERBACK, VERIFIED_ON } from "@/lib/specs";

const TRIMS: Record<string, [number, number]> = { "5 x 8": [5, 8], "5.25 x 8": [5.25, 8], "5.5 x 8.5": [5.5, 8.5], "6 x 9": [6, 9], "8.5 x 11": [8.5, 11] };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book";

export default function CoverStudio({ project, imageUrl, coverId, onChooseCover }: { project: any; imageUrl: string; coverId: string; onChooseCover: (id: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const saved = project.settings?.design ?? {};
  const [d, setD] = useState<Design>({
    title: project.title, subtitle: "", author: project.author, font: "serif", color: "#ffffff", position: "top", shade: 0.35,
    backBg: "#f4efe6", backText: "#111111", blurb: project.approved_blurb ?? "", tagline: project.marketing?.taglines?.[0] ?? "", ...saved,
  });
  const ps = project.settings?.print ?? {};
  const [trim, setTrim] = useState<string>(ps.trim ?? "6 x 9");
  const [customW, setCustomW] = useState(ps.customW ?? 6); const [customH, setCustomH] = useState(ps.customH ?? 9);
  const [pages, setPages] = useState<number>(ps.pages ?? project.extraction?.pages ?? 0); const [paper, setPaper] = useState<string>(ps.paper ?? "bw_cream");
  const [ingramSpine, setIngramSpine] = useState<number>(ps.ingramSpine ?? 0);
  const [dest, setDest] = useState<Record<string, boolean>>({ kdp_ebook: true, kdp_paperback: false, ingram_print: false });
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [tab, setTab] = useState<"ebook" | "kdp" | "ingram">("ebook");
  const [checks, setChecks] = useState<Record<string, Check[]>>({}); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  const cvs = useRef<HTMLCanvasElement>(null);
  const [saves, setSaves] = useState<any[]>([]); const [saveName, setSaveName] = useState("");
  const loadSaves = async () => { const { data } = await sb.from("designs").select("*").eq("project_id", project.id).order("created_at", { ascending: false }); setSaves(data ?? []); };
  useEffect(() => { loadSaves(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id]);
  async function saveDesign() {
    const name = saveName.trim() || `Design ${saves.length + 1}`;
    const { error } = await sb.from("designs").insert({ project_id: project.id, name, design: d, print: { trim, customW, customH, pages, paper, ingramSpine }, cover_id: coverId });
    if (error) return setMsg("Could not save: " + error.message); setSaveName(""); setMsg(`Saved "${name}".`); loadSaves();
  }
  function loadDesign(s: any) {
    setD(s.design); const pr = s.print ?? {};
    setTrim(pr.trim ?? "6 x 9"); setCustomW(pr.customW ?? 6); setCustomH(pr.customH ?? 9); setPages(pr.pages ?? 0); setPaper(pr.paper ?? "bw_cream"); setIngramSpine(pr.ingramSpine ?? 0);
    if (s.cover_id && s.cover_id !== coverId) onChooseCover(s.cover_id); setMsg(`Opened "${s.name}".`);
  }
  async function deleteDesign(id: string) { if (!confirm("Delete this saved design?")) return; await sb.from("designs").delete().eq("id", id); loadSaves(); }
  const [tw, th] = trim === "custom" ? [customW, customH] : TRIMS[trim];
  const barcode = INGRAM_PRINT.barcodeAreaIn;

  useEffect(() => { let on = true; (async () => { const b = await (await fetch(imageUrl)).blob(); const bm = await createImageBitmap(b); if (on) setImg(bm); })().catch(() => setMsg("Could not load the cover image.")); return () => { on = false; }; }, [imageUrl]);
  useEffect(() => { setD((x) => ({ ...x, blurb: project.approved_blurb ?? x.blurb })); }, [project.approved_blurb]);

  const spineFor = (k: "kdp" | "ingram") => k === "kdp" ? kdpSpine(pages || 0, paper) : ingramSpine;
  const cfgFor = (k: "kdp" | "ingram"): PrintCfg => k === "kdp"
    ? { trimW: tw, trimH: th, spine: spineFor("kdp"), bleed: KDP_PAPERBACK.bleedIn, safe: KDP_PAPERBACK.safeIn, ppi: 300 }
    : { trimW: tw, trimH: th, spine: spineFor("ingram"), bleed: INGRAM_PRINT.bleedIn, safe: INGRAM_PRINT.typeSafetyIn, ppi: 300 };
  const spineText = (k: "kdp" | "ingram") => k === "kdp" ? pages >= KDP_PAPERBACK.spineTextMinPages : pages >= INGRAM_PRINT.spineTextMinPages;

  // live preview
  useEffect(() => {
    const c = cvs.current; if (!c || !img) return; const ctx = c.getContext("2d")!;
    let src: HTMLCanvasElement;
    if (tab === "ebook") { src = renderEbook(img, d); }
    else { const k = tab === "kdp" ? "kdp" : "ingram"; const cfg = { ...cfgFor(k), ppi: 40 }; if (!cfg.spine) cfg.spine = 0.25; src = renderWrap(img, cfg, d, spineText(k), true, barcode).canvas; }
    const scale = Math.min(1, 900 / src.width); c.width = src.width * scale; c.height = src.height * scale; ctx.drawImage(src, 0, 0, c.width, c.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, d, tab, trim, customW, customH, pages, paper, ingramSpine]);

  // autosave design/print settings
  useEffect(() => {
    const t = setTimeout(async () => { await sb.from("projects").update({ settings: { ...(project.settings ?? {}), design: d, print: { trim, customW, customH, pages, paper, ingramSpine } } }).eq("id", project.id); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, trim, customW, customH, pages, paper, ingramSpine]);

  const up = (k: keyof Design, v: any) => setD((x) => ({ ...x, [k]: v }));

  async function exportZip() {
    if (!img) return; setBusy("Building files..."); setMsg(""); const zip = new JSZip(); const report: any = { generatedAt: new Date().toISOString(), profileRulesVerifiedOn: VERIFIED_ON, destinations: {}, notice: "Files are cover assets only. Not an upload-ready complete book package, and not retailer-approved." };
    const out: Record<string, Check[]> = {}; const base = slug(project.title);
    try {
      if (dest.kdp_ebook) {
        const c = renderEbook(img, d); const blob = await toBlob(c); const ck = validate("kdp_ebook", { imgW: img.width, imgH: img.height, bytes: blob.size });
        out.kdp_ebook = ck; report.destinations.kdp_ebook = { checks: ck, file: ck.some((x) => x.level === "blocker") ? null : "kdp_ebook/cover.jpg" };
        if (!ck.some((x) => x.level === "blocker")) zip.file("kdp_ebook/cover.jpg", blob);
      }
      for (const [key, k] of [["kdp_paperback", "kdp"], ["ingram_print", "ingram"]] as const) {
        if (!dest[key]) continue; const cfg = cfgFor(k);
        const r = renderWrap(img, cfg, d, spineText(k), false, barcode);
        const ck = validate(key, { imgW: img.width, imgH: img.height, pages, spine: cfg.spine, blurbFits: r.blurbFits, cfg, frontPpi: r.frontImgPpi });
        out[key] = ck; const blocked = ck.some((x) => x.level === "blocker");
        const name = key === "ingram_print" ? `${key}/cover-wrap-RGB-NEEDS-CMYK-CONVERSION.pdf` : `${key}/cover-wrap.pdf`;
        report.destinations[key] = { checks: ck, file: blocked ? null : name, dimensionsIn: { width: +r.totalW.toFixed(4), height: +r.totalH.toFixed(4) }, spineIn: cfg.spine, pages };
        if (!blocked) zip.file(name, await wrapToPdf(r.canvas, r.totalW, r.totalH));
      }
      setChecks(out);
      const blurb = d.blurb || project.approved_blurb || "";
      zip.file("blurb.txt", blurb + "\n");
      zip.file("metadata.json", JSON.stringify({ title: project.title, author: project.author, genre: project.genre, brief: { logline: project.brief?.logline, primary_audience: project.brief?.primary_audience, themes: project.brief?.themes }, marketing: project.marketing ?? null }, null, 2));
      zip.file("validation-report.json", JSON.stringify(report, null, 2));
      zip.file("README.txt", `Cover export for "${project.title}"\nGenerated: ${new Date().toISOString()}\nPublisher rules verified: ${VERIFIED_ON} (see the in-app Guide for current status)\n\nThis ZIP holds cover assets and text only. Check validation-report.json for blockers and warnings.\nAI artwork was generated with FLUX.1-schnell via a Hugging Face Space; confirm the model license and each retailer's AI-content disclosure rules yourself before publishing.\nNothing here has been uploaded or approved by any retailer.\n`);
      const blob = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${base}-covers-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
      setMsg(Object.values(out).some((c) => c.some((x) => x.level === "blocker")) ? "Downloaded, but some destinations were skipped because of blockers (see below)." : "Downloaded.");
    } catch (e: any) { setMsg("Export failed: " + e.message); } finally { setBusy(""); }
  }

  return (
    <section className="card">
      <h2>5. Design the type &amp; export</h2>
      <p className="muted">Title and author are drawn on top of the artwork here, so changing them never uses a generation. Fonts are common system fonts.</p>
      <div className="banner" style={{ background: "#eef5ee", borderColor: "var(--ok)" }}>
        <b>Saved designs</b> <span className="muted">- your latest changes are saved automatically; use this to keep named versions you can come back to and change later.</span>
        <div className="row" style={{ marginTop: 8 }}>
          <div><input placeholder="Name this design, e.g. Blue lighthouse - serif" value={saveName} onChange={(e) => setSaveName(e.target.value)} /></div>
          <div style={{ flex: "0 0 auto" }}><button className="small" onClick={saveDesign}>Save this design</button></div>
        </div>
        {saves.map((x) => (<div key={x.id} className="row" style={{ marginTop: 6, alignItems: "center" }}><div style={{ flex: "1 1 200px" }}><b>{x.name}</b> <span className="muted">{new Date(x.created_at).toLocaleString()}</span></div><div style={{ flex: "0 0 auto" }}><button className="small ghost" onClick={() => loadDesign(x)}>Open</button> <button className="small ghost" onClick={() => deleteDesign(x.id)}>Delete</button></div></div>))}
        {!saves.length && <p className="muted" style={{ margin: "6px 0 0" }}>Nothing saved yet.</p>}
      </div>
      <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)" }}>
        <div>
          <label>Title</label><input value={d.title} onChange={(e) => up("title", e.target.value)} />
          <label style={{ marginTop: 8 }}>Subtitle (optional)</label><input value={d.subtitle} onChange={(e) => up("subtitle", e.target.value)} />
          <label style={{ marginTop: 8 }}>Author</label><input value={d.author} onChange={(e) => up("author", e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <div><label>Style</label><select value={d.font} onChange={(e) => up("font", e.target.value)}><option value="serif">Classic serif</option><option value="sans">Clean sans</option><option value="display">Bold display</option></select></div>
            <div><label>Text position</label><select value={d.position} onChange={(e) => up("position", e.target.value)}><option value="top">Title top</option><option value="middle">Title middle</option><option value="bottom">Title bottom</option></select></div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div><label>Title color</label><input type="color" value={d.color} onChange={(e) => up("color", e.target.value)} /></div>
            <div><label>Darken behind text: {Math.round(d.shade * 100)}%</label><input type="range" min={0} max={0.7} step={0.05} value={d.shade} onChange={(e) => up("shade", +e.target.value)} /></div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <div><label>Back cover color</label><input type="color" value={d.backBg} onChange={(e) => up("backBg", e.target.value)} /></div>
            <div><label>Back text color</label><input type="color" value={d.backText} onChange={(e) => up("backText", e.target.value)} /></div>
          </div>
          <label style={{ marginTop: 8 }}>Back-cover tagline (optional)</label><input value={d.tagline} onChange={(e) => up("tagline", e.target.value)} />
          <label style={{ marginTop: 8 }}>Back-cover blurb (approved text; editing here only affects the export)</label><textarea value={d.blurb} onChange={(e) => up("blurb", e.target.value)} />

          <h3 style={{ marginTop: 16 }}>Print settings</h3>
          <div className="row">
            <div><label>Trim size (in)</label><select value={trim} onChange={(e) => setTrim(e.target.value)}>{Object.keys(TRIMS).map((t) => <option key={t}>{t}</option>)}<option value="custom">Custom</option></select></div>
            <div><label>Final page count (formatted interior)</label><input type="number" min={0} value={pages || ""} onChange={(e) => setPages(+e.target.value)} /></div>
          </div>
          {trim === "custom" && <div className="row"><div><label>Width in</label><input type="number" step="0.05" value={customW} onChange={(e) => setCustomW(+e.target.value)} /></div><div><label>Height in</label><input type="number" step="0.05" value={customH} onChange={(e) => setCustomH(+e.target.value)} /></div></div>}
          <div className="row" style={{ marginTop: 8 }}>
            <div><label>KDP ink &amp; paper</label><select value={paper} onChange={(e) => setPaper(e.target.value)}>{Object.entries(KDP_PAPERBACK.spineLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label>KDP spine (computed, in)</label><input readOnly value={spineFor("kdp") || ""} /></div>
          </div>
          <div className="row" style={{ marginTop: 8 }}><div><label>IngramSpark spine width (in) - from their Cover Template Generator</label><input type="number" step="0.001" value={ingramSpine || ""} onChange={(e) => setIngramSpine(+e.target.value)} /></div></div>
          {!ps.pages && project.extraction?.pages ? <p className="okc" style={{ fontSize: ".85rem" }}>Page count filled in from your PDF ({project.extraction.pages}). Confirm it matches the published paperback.</p> : null}
          <p className="muted">Use the book's <b>final formatted</b> page count from the existing published interior, not the manuscript's page count.</p>
        </div>

        <div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {([["ebook", "Ebook front"], ["kdp", "KDP print wrap"], ["ingram", "IngramSpark wrap"]] as const).map(([k, l]) => <button key={k} className={`small ${tab === k ? "" : "ghost"}`} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <canvas ref={cvs} className="preview" />
          <p className="muted">Blue dashed line = trim; red dashed box = barcode area (preview only, not exported).</p>
          <h3>Export</h3>
          {([["kdp_ebook", "Amazon KDP - ebook cover (JPEG)"], ["kdp_paperback", "Amazon KDP - paperback full wrap (PDF)"], ["ingram_print", "IngramSpark - paperback full wrap (PDF, needs CMYK conversion)"]] as const).map(([k, l]) => (
            <label key={k} style={{ display: "flex", gap: 8, color: "inherit" }}><input type="checkbox" style={{ width: "auto" }} checked={dest[k]} onChange={(e) => setDest({ ...dest, [k]: e.target.checked })} />{l}</label>))}
          <div style={{ height: 8 }} /><button onClick={exportZip} disabled={!!busy || !img}>{busy || "Validate & download ZIP"}</button> <span className="muted">{msg}</span>
          {Object.entries(checks).map(([k, list]) => (<div key={k} style={{ marginTop: 10 }}><b>{k.replace(/_/g, " ")}</b>{list.map((c, i) => <div key={i} className={`check ${c.level}`}><b>{c.level.toUpperCase()}:</b> {c.text}</div>)}</div>))}
          <p className="muted">Rules last verified {VERIFIED_ON}. Ebook: ideal {KDP_EBOOK.idealPx.h}x{KDP_EBOOK.idealPx.w}px. Always do a final check in each publisher's own previewer.</p>
        </div>
      </div>
    </section>
  );
}
