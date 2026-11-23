"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password: pw });
    if (error) { setMsg("Sign-in failed: " + error.message); setBusy(false); } else window.location.href = "/";
  }
  return (
    <div className="wrap" style={{ maxWidth: 440, paddingTop: 80 }}>
      <h1>Cover &amp; Blurb Studio</h1>
      <p className="muted">Private tool. Accounts are created by the administrator.</p>
      <section className="card">
        <form onSubmit={go}>
          <label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <div style={{ height: 10 }} />
          <label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="current-password" />
          <div style={{ height: 14 }} />
          <button disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
          {msg && <p className="err">{msg}</p>}
        </form>
      </section>
    </div>
  );
}
