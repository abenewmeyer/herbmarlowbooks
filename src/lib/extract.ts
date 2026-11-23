import mammoth from "mammoth";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

export const CHUNK_CHARS = 9000;
export type Chunk = { seq: number; locator: string; body: string };
export type Extraction = { chunks: Chunk[]; pages?: number; emptyPages?: number; words: number; warning?: string };

export async function extractPdf(buf: Uint8Array): Promise<Extraction> {
  const pdf = await getDocumentProxy(buf);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t) => t.replace(/\s+\n/g, "\n").trim());
  const emptyPages = pages.filter((p) => p.length < 20).length;
  if (totalPages > 0 && emptyPages / totalPages > 0.5)
    throw new Error("This PDF looks scanned (images, not text). Scanned PDFs are not supported yet - export a text-based PDF or upload the Word file.");
  const chunks: Chunk[] = []; let cur = ""; let start = 1;
  pages.forEach((p, i) => {
    if (cur.length + p.length > CHUNK_CHARS && cur) { chunks.push({ seq: chunks.length, locator: `pp. ${start}-${i}`, body: cur }); cur = ""; start = i + 1; }
    // very long single pages are split
    let rest = p;
    while (rest.length > CHUNK_CHARS) { chunks.push({ seq: chunks.length, locator: `p. ${i + 1}`, body: rest.slice(0, CHUNK_CHARS) }); rest = rest.slice(CHUNK_CHARS); start = i + 1; }
    cur += (cur ? "\n\n" : "") + rest;
  });
  if (cur.trim()) chunks.push({ seq: chunks.length, locator: `pp. ${start}-${pages.length}`, body: cur });
  const words = pages.join(" ").split(/\s+/).filter(Boolean).length;
  return { chunks, pages: totalPages, emptyPages, words };
}

function fromParagraphs(paras: string[], words: number): Extraction {
  const chunks: Chunk[] = []; let cur = "";
  const push = () => { if (cur.trim()) { chunks.push({ seq: chunks.length, locator: `section ${chunks.length + 1}`, body: cur }); cur = ""; } };
  for (const p of paras) {
    if (cur.length + p.length > CHUNK_CHARS) push();
    let rest = p; while (rest.length > CHUNK_CHARS) { cur = rest.slice(0, CHUNK_CHARS); push(); rest = rest.slice(CHUNK_CHARS); }
    cur += (cur ? "\n\n" : "") + rest;
  }
  push();
  return { chunks, words };
}

export async function extractDocx(buf: Buffer): Promise<Extraction> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const paras = value.split(/\n{2,}|\r\n\r\n/).map((s) => s.trim()).filter(Boolean);
  if (!paras.length) throw new Error("No text found in this Word file.");
  return fromParagraphs(paras, value.split(/\s+/).filter(Boolean).length);
}

export async function extractEpub(buf: Buffer): Promise<Extraction> {
  const zip = await JSZip.loadAsync(buf);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  const opfFile = opfPath ? zip.file(opfPath) : null;
  if (!opfPath || !opfFile) throw new Error("This EPUB is damaged or unusual (no package file). Try the PDF or Word version.");
  const opf = await opfFile.async("string");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const manifest: Record<string, string> = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1]; let href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) { try { href = decodeURIComponent(href); } catch { /* keep raw */ } manifest[id] = href; }
  }
  const order = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);
  const paras: string[] = []; let words = 0;
  for (const id of order) {
    const href = manifest[id]; const f = href ? zip.file(base + href) : null; if (!f) continue;
    const t = (await f.async("string"))
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/[ \t]+/g, " ");
    for (const para of t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)) { paras.push(para); words += para.split(/\s+/).length; }
  }
  if (!paras.length) throw new Error("No readable text found in this EPUB.");
  return fromParagraphs(paras, words);
}
