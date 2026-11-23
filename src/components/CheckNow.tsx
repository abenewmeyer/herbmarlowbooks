"use client";
import { useState } from "react";
export default function CheckNow() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function run() { setBusy(true); setMsg(""); const r = await fetch("/api/cron/check-specs", { method: "POST" }); setMsg(r.ok ? "Check finished - reloading..." : "Check failed."); if (r.ok) setTimeout(() => location.reload(), 800); setBusy(false); }
  return (<span className="noprint"><button className="small" onClick={run} disabled={busy}>{busy ? "Checking..." : "Check publisher pages now"}</button> <span className="muted">{msg}</span></span>);
}
