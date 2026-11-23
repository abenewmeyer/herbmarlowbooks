"use client";
export default function Marketing({ m, brief }: { m: any; brief: any }) {
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  const List = ({ title, items }: { title: string; items?: string[] }) => !items?.length ? null : (
    <div style={{ marginBottom: 14 }}><h3>{title} <button className="small ghost" onClick={() => copy(items.join(", "))}>Copy</button></h3><div className="tags">{items.map((t, i) => <span className="tag" key={i}>{t}</span>)}</div></div>);
  return (
    <section className="card">
      <h2>Marketing intel</h2>
      <p className="muted">Built from the approved brief for your marketing team. Included in the export ZIP as metadata.json. Category names are suggestions - check them against each retailer's current category list.</p>
      <List title="Tags" items={m.tags} /><List title="Search phrases" items={m.keyword_phrases} /><List title="Topics" items={m.topics} />
      {m.category_suggestions?.length > 0 && <><h3>Category suggestions</h3><table><tbody>{m.category_suggestions.map((c: any, i: number) => <tr key={i}><td>{c.label}</td><td>{c.note}</td></tr>)}</tbody></table></>}
      {m.audiences?.length > 0 && <><h3 style={{ marginTop: 14 }}>Possible audiences</h3><table><thead><tr><th>Segment</th><th>Why</th><th>Where to reach</th></tr></thead><tbody>{m.audiences.map((a: any, i: number) => <tr key={i}><td>{a.segment}</td><td>{a.why}</td><td>{a.where_to_reach}</td></tr>)}</tbody></table></>}
      <div style={{ height: 12 }} /><List title="Hooks" items={m.hooks} /><List title="Tagline ideas" items={m.taglines} /><List title="Social angles" items={m.social_angles} />
      <List title="Positioning (internal only)" items={m.comparable_positioning} /><List title="Content notes" items={m.content_notes} /><List title="Caveats" items={m.caveats} />
      {brief?.primary_audience && <p className="muted">Primary audience from brief: {brief.primary_audience}</p>}
    </section>
  );
}
