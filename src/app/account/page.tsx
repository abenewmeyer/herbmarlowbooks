"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Account() {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setMsg("Use at least 10 characters.");
    if (pw !== pw2) return setMsg("The two passwords do not match.");
    const sb = supabaseBrowser();
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    const { data } = await sb.auth.getUser();
    if (data.user) await sb.from("user_flags").upsert({ user_id: data.user.id, pw_changed: true });
    setMsg("Password changed. You can return to the studio.");
  }
  return (
    <div className="wrap" style={{ maxWidth: 480, paddingTop: 50 }}>
      <p><a href="/">&larr; Back to studio</a></p>
      <h1>Change password</h1>
      <section className="card"><form onSubmit={save}>
        <label>New password (10+ characters)</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <div style={{ height: 10 }} /><label>Repeat new password</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        <div style={{ height: 14 }} /><button>Save new password</button>
        {msg && <p className={msg.startsWith("Password changed") ? "okc" : "err"}>{msg}</p>}
      </form></section>
    </div>
  );
}
