import { supabaseServer } from "@/lib/supabase/server";
import { PROFILES, SOURCES, VERIFIED_BY, VERIFIED_ON, KDP_PAPERBACK } from "@/lib/specs";
import CheckNow from "@/components/CheckNow";
export const dynamic = "force-dynamic";

export default async function Guide() {
  const sb = await supabaseServer();
  const { data: checks } = await sb.from("spec_checks").select("*").order("checked_at", { ascending: false }).limit(60);
  const latest = (k: string) => checks?.find((c: any) => c.source_key === k);
  const lastOk = (k: string) => checks?.find((c: any) => c.source_key === k && ["unchanged", "first_snapshot", "changed_needs_review"].includes(c.status));
  const pending = SOURCES.filter((s) => latest(s.key)?.status === "changed_needs_review");
  const now = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  return (
    <div className="wrap">
      <div className="top"><a href="/">&larr; Back to studio</a><span className="muted">Tip: use your browser's Print / Save as PDF to keep a dated copy.</span></div>
      <h1 style={{ marginTop: 20 }}>Workflow &amp; Reference Guide</h1>
      <section className="card">
        <table><tbody>
          <tr><th>Guide generated</th><td>{now} (built live from the app's current rules and check records)</td></tr>
          <tr><th>Publisher rules last verified</th><td>{VERIFIED_ON} - {VERIFIED_BY}</td></tr>
          <tr><th>Pending rule changes</th><td>{pending.length ? <b className="err">Update pending review: {pending.map((p) => p.label).join("; ")}</b> : "None flagged"}</td></tr>
          <tr><th>Monthly scan</th><td>Runs automatically on the 1st of each month (03:00 UTC). <CheckNow /></td></tr>
        </tbody></table>
        <p className="muted">A scan only detects that an official page changed. It never edits the rules automatically - a person compares the page with the rules below and the developer updates <code>src/lib/specs.ts</code>. A failed scan never advances the "last successful check" date.</p>
      </section>

      <section className="card"><h2>Publisher page check status</h2>
        <table><thead><tr><th>Source</th><th>Last scan</th><th>Result</th><th>Last successful scan</th></tr></thead><tbody>
          {SOURCES.map((s) => { const l = latest(s.key), ok = lastOk(s.key); return (
            <tr key={s.key}><td><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></td>
              <td>{l ? new Date(l.checked_at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "Not yet scanned"}</td>
              <td>{l ? l.status.replace(/_/g, " ") : "-"}{l?.detail ? ` - ${l.detail}` : ""}</td>
              <td>{ok ? new Date(ok.checked_at).toISOString().slice(0, 10) : "Never"}</td></tr>); })}
        </tbody></table>
      </section>

      <section className="card"><h2>Normal workflow</h2>
        <ol>
          <li><b>Upload</b> - choose the PDF (text-based) or Word .docx manuscript. Confirm you have the rights; text is sent to the AI service.</li>
          <li><b>Analyze</b> - the app reads the book in sections, then writes a book brief. Read it against your book and correct anything wrong, then approve it.</li>
          <li><b>Your vision</b> - describe what you picture for the cover. Concepts, three blurb options and marketing intel are generated from the brief plus your vision.</li>
          <li><b>Covers &amp; blurb</b> - pick one of three covers (regenerate with a note if none is close; watch the daily counter), choose and edit a blurb, approve it.</li>
          <li><b>Design</b> - set title/author type, trim size and page count, preview the full wrap.</li>
          <li><b>Export</b> - choose destinations, review blockers/warnings, download the ZIP, then upload to the publisher's site yourself.</li>
        </ol>
      </section>

      <section className="card"><h2>Verified publisher rules (as of {VERIFIED_ON})</h2>
        {PROFILES.map((p) => (<div key={p.id}><h3>{p.label}</h3><ul>{p.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>))}
        <h3>KDP spine width factors (inches per page)</h3>
        <table><tbody>{Object.entries(KDP_PAPERBACK.spinePerPage).map(([k, v]) => <tr key={k}><td>{KDP_PAPERBACK.spineLabels[k]}</td><td>{v}</td></tr>)}</tbody></table>
        <p className="muted">Values not stated on the official pages are marked unknown in the notes above and were not guessed.</p>
      </section>

      <section className="card"><h2>Replacing an existing book's cover and description</h2>
        <ul>
          <li>Cover and blurb can be replaced without re-uploading the interior in your publisher dashboard; confirm the exact steps on KDP / IngramSpark, since their dashboards change (not verified here).</li>
          <li>Full manuscript typesetting and EPUB production are a separate phase and are not part of this tool.</li>
          <li>This tool never uploads, publishes or buys anything for you.</li>
        </ul>
      </section>

      <section className="card"><h2>Troubleshooting</h2>
        <ul>
          <li><b>Daily image counter at 0:</b> wait for the reset (shown in the studio) or upload your own artwork to any cover slot.</li>
          <li><b>"Rate limited" while analyzing:</b> the free text AI allows limited tokens per minute. The app waits and retries; leaving the tab open is fine. Progress is saved - press Analyze again to continue.</li>
          <li><b>Scanned PDF rejected:</b> upload the Word file or a text-based PDF.</li>
          <li><b>Forgot password:</b> ask the administrator to reset it in Supabase.</li>
        </ul>
      </section>
      <section className="card"><h2>Privacy</h2><p>Manuscripts are stored in private Supabase storage, visible only to the account that uploaded them. Text is sent to Groq for analysis; only short art prompts (not the manuscript) go to the image service. Delete a project in the studio to remove its files and data (provider and backup retention may differ).</p></section>
    </div>
  );
}
