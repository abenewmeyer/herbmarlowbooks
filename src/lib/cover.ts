// Client-side cover rendering + validation. Typography is drawn separately from the artwork so edits never cost an AI generation.
import { PDFDocument } from "pdf-lib";
import { INGRAM_PRINT, KDP_EBOOK, KDP_PAPERBACK } from "./specs";

export type Design = {
  title: string; subtitle: string; author: string; font: "serif" | "sans" | "display";
  color: string; position: "top" | "middle" | "bottom"; shade: number;
  backBg: string; backText: string; blurb: string; tagline: string;
};
export const FONTS = { serif: 'Georgia, "Times New Roman", serif', sans: '"Segoe UI", Arial, sans-serif', display: 'Impact, "Arial Black", sans-serif' };
export type PrintCfg = { trimW: number; trimH: number; spine: number; bleed: number; safe: number; ppi: number };
export type Check = { level: "blocker" | "warning" | "info"; text: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; };

function coverFit(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawFront(ctx: CanvasRenderingContext2D, img: any, region: { x: number; y: number; w: number; h: number }, trim: { x: number; y: number; w: number; h: number }, safe: number, d: Design) {
  ctx.save(); ctx.beginPath(); ctx.rect(region.x, region.y, region.w, region.h); ctx.clip();
  coverFit(ctx, img, region.x, region.y, region.w, region.h);
  const sx = trim.x + safe, sw = trim.w - 2 * safe, sTop = trim.y + safe, sBot = trim.y + trim.h - safe;
  // title block
  let size = trim.w * 0.14; let lines: string[] = [];
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (; size > 12; size -= 2) {
    ctx.font = `bold ${size}px ${FONTS[d.font]}`; lines = wrap(ctx, d.title, sw);
    if (lines.length <= 4 && lines.every((l) => ctx.measureText(l).width <= sw)) break;
  }
  const lh = size * 1.12; const subSize = size * 0.38; const blockH = lines.length * lh + (d.subtitle ? subSize * 1.8 : 0);
  const authorSize = trim.w * 0.06;
  const y0 = d.position === "top" ? sTop : d.position === "middle" ? trim.y + (trim.h - blockH) / 2 : sBot - authorSize * 2.2 - blockH - trim.h * 0.04;
  if (d.shade > 0) {
    const g = ctx.createLinearGradient(0, y0 - trim.h * 0.08, 0, y0 + blockH + trim.h * 0.1);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.25, `rgba(0,0,0,${d.shade})`); g.addColorStop(0.75, `rgba(0,0,0,${d.shade})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(region.x, y0 - trim.h * 0.08, region.w, blockH + trim.h * 0.18);
    if (d.position === "bottom" || d.position === "top") { const g2 = ctx.createLinearGradient(0, sBot - authorSize * 3, 0, trim.y + trim.h); g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, `rgba(0,0,0,${d.shade})`); ctx.fillStyle = g2; ctx.fillRect(region.x, sBot - authorSize * 3, region.w, region.y + region.h - (sBot - authorSize * 3)); }
  }
  ctx.fillStyle = d.color; ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = size * 0.08;
  ctx.font = `bold ${size}px ${FONTS[d.font]}`;
  const cx = sx + sw / 2; lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
  if (d.subtitle) { ctx.font = `italic ${subSize}px ${FONTS.serif}`; ctx.fillText(d.subtitle, cx, y0 + lines.length * lh + subSize * 0.4); }
  ctx.font = `${authorSize}px ${FONTS[d.font === "display" ? "sans" : d.font]}`; ctx.textBaseline = "alphabetic";
  ctx.fillText(d.author.toUpperCase(), cx, sBot - authorSize * 0.3, sw);
  ctx.restore();
}

/** returns false if the blurb could not fit at >= 8pt */
export function drawBack(ctx: CanvasRenderingContext2D, region: { x: number; y: number; w: number; h: number }, trim: { x: number; y: number; w: number; h: number }, safe: number, ppi: number, d: Design, guides: boolean, barcode: { w: number; h: number }) {
  ctx.fillStyle = d.backBg; ctx.fillRect(region.x, region.y, region.w, region.h);
  const x = trim.x + safe * 1.6, w = trim.w - safe * 3.2; let y = trim.y + safe * 1.8;
  const bx = trim.x + trim.w - safe - barcode.w * ppi, by = trim.y + trim.h - safe - barcode.h * ppi;
  ctx.fillStyle = d.backText; ctx.textAlign = "left"; ctx.textBaseline = "top";
  if (d.tagline) { const s = trim.w * 0.05; ctx.font = `italic bold ${s}px ${FONTS.serif}`; const tl = wrap(ctx, d.tagline, w); tl.forEach((l, i) => ctx.fillText(l, x, y + i * s * 1.25)); y += tl.length * s * 1.25 + s * 0.8; }
  const maxBottom = by - safe * 0.6; let fit = true; let size = trim.w * 0.04; let lines: string[] = [];
  const minPx = (8 / 72) * ppi;
  for (; ; size -= 1) {
    ctx.font = `${size}px ${FONTS.serif}`; lines = wrap(ctx, d.blurb, w);
    if (y + lines.length * size * 1.45 <= maxBottom) break;
    if (size <= minPx) { fit = false; break; }
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.45));
  if (guides) { ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = "#e11"; ctx.strokeRect(bx, by, barcode.w * ppi, barcode.h * ppi); ctx.fillStyle = "#e11"; ctx.font = `${Math.max(10, ppi * 0.12)}px sans-serif`; ctx.fillText("barcode area", bx + 4, by + 4); ctx.restore(); }
  return fit;
}

export function drawSpine(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, d: Design, withText: boolean, safeSide: number) {
  ctx.fillStyle = d.backBg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (!withText) return;
  ctx.save(); ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2); ctx.rotate(Math.PI / 2);
  const maxLen = rect.h * 0.8; let size = (rect.w - 2 * safeSide) * 0.6;
  const text = `${d.title}   •   ${d.author}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = d.backText;
  for (; size > 6; size -= 1) { ctx.font = `bold ${size}px ${FONTS.serif}`; if (ctx.measureText(text).width <= maxLen) break; }
  ctx.fillText(text, 0, 0); ctx.restore();
}

export function renderWrap(img: any, cfg: PrintCfg, d: Design, spineText: boolean, guides: boolean, barcode: { w: number; h: number }) {
  const { trimW, trimH, spine, bleed, safe, ppi } = cfg; const P = (v: number) => v * ppi;
  const totalW = bleed * 2 + trimW * 2 + spine, totalH = trimH + bleed * 2;
  const c = mk(P(totalW), P(totalH)); const ctx = c.getContext("2d")!;
  const backReg = { x: 0, y: 0, w: P(bleed + trimW), h: P(totalH) };
  const backTrim = { x: P(bleed), y: P(bleed), w: P(trimW), h: P(trimH) };
  const spineRect = { x: P(bleed + trimW), y: 0, w: P(spine), h: P(totalH) };
  const frontX = P(bleed + trimW + spine);
  const frontReg = { x: frontX, y: 0, w: P(trimW + bleed), h: P(totalH) };
  const frontTrim = { x: frontX, y: P(bleed), w: P(trimW), h: P(trimH) };
  const fit = drawBack(ctx, backReg, backTrim, P(safe), ppi, d, guides, barcode);
  drawSpine(ctx, spineRect, d, spineText, P(0.0625));
  drawFront(ctx, img, frontReg, frontTrim, P(safe), d);
  if (guides) { ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = "rgba(0,180,255,.9)"; ctx.lineWidth = 2; ctx.strokeRect(P(bleed), P(bleed), P(totalW - 2 * bleed), P(trimH)); ctx.restore(); }
  return { canvas: c, blurbFits: fit, totalW, totalH, frontImgPpi: img.width / (trimW + bleed) };
}

export function renderEbook(img: any, d: Design) {
  const W = KDP_EBOOK.idealPx.w, H = KDP_EBOOK.idealPx.h; const c = mk(W, H); const ctx = c.getContext("2d")!;
  drawFront(ctx, img, { x: 0, y: 0, w: W, h: H }, { x: 0, y: 0, w: W, h: H }, W * 0.07, d);
  return c;
}
export const toBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.95) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), type, q));

export async function wrapToPdf(c: HTMLCanvasElement, widthIn: number, heightIn: number) {
  const pdf = await PDFDocument.create(); pdf.setTitle("Cover wrap"); pdf.setProducer("herbmarlowbooks");
  const jpg = await pdf.embedJpg(await (await toBlob(c, "image/jpeg", 0.95)).arrayBuffer());
  const page = pdf.addPage([widthIn * 72, heightIn * 72]); page.drawImage(jpg, { x: 0, y: 0, width: widthIn * 72, height: heightIn * 72 });
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}

export const kdpSpine = (pages: number, paper: string) => Math.round(pages * KDP_PAPERBACK.spinePerPage[paper] * 10000) / 10000;

export function validate(kind: "kdp_ebook" | "kdp_paperback" | "ingram_print", o: { imgW: number; imgH: number; pages?: number; spine?: number; blurbFits?: boolean; cfg?: PrintCfg; frontPpi?: number; bytes?: number }): Check[] {
  const out: Check[] = []; const add = (level: Check["level"], text: string) => out.push({ level, text });
  if (kind === "kdp_ebook") {
    if (o.imgH < KDP_EBOOK.minPx.h || o.imgW < KDP_EBOOK.minPx.w) add("blocker", "Source artwork is below KDP's 1,000 x 625 px minimum.");
    add("warning", `Artwork is ${o.imgW}x${o.imgH}px and is scaled up to KDP's ideal 2,560x1,600. Scaling adds no real detail; it meets KDP's minimum but may look soft.`);
    if (o.bytes && o.bytes > KDP_EBOOK.maxBytes) add("blocker", "File is over KDP's 50 MB limit.");
    add("info", "Format JPEG, RGB, 1.6:1 ratio or taller, within 10,000 px - meets the verified criteria.");
    add("warning", "If the cover is light, KDP recommends a thin medium-gray border. Check the preview on a white page.");
    add("warning", "Manual checks: legibility at thumbnail size, face/subject cropping, and KDP's AI-generated-content disclosure answer.");
    return out;
  }
  const cfg = o.cfg!;
  if (!o.pages || o.pages < 1) add("blocker", "Final formatted page count is required for print covers (the raw manuscript page count is not acceptable).");
  if (kind === "kdp_paperback") {
    if (!o.spine) add("blocker", "Spine width could not be computed - choose ink/paper and page count.");
    if ((o.pages ?? 0) > 0 && (o.pages ?? 0) < KDP_PAPERBACK.spineTextMinPages) add("info", "Spine text is omitted: KDP does not allow spine text on very short books (~79-80 pages).");
    add("info", "Spine from KDP's verified per-page factors. Still compare to KDP's cover calculator before uploading.");
    add("warning", "Exported as RGB. KDP recommends CMYK and flattened, embedded-font PDFs; KDP may convert colors, so expect small color shifts.");
  } else {
    if (!o.spine) add("blocker", "Enter the spine width from IngramSpark's Cover Template Generator.");
    if ((o.pages ?? 0) > 0 && (o.pages ?? 0) < INGRAM_PRINT.spineTextMinPages) add("info", "Spine text omitted: IngramSpark allows none under 48 pages.");
    add("warning", "NOT UPLOAD-READY: this app exports an RGB PDF. IngramSpark requires CMYK, ideally PDF/X-1a:2001, and small text (24 pt or less) in 100% black. Convert the file with a CMYK-capable tool and run IngramSpark's own file check before relying on it.");
    add("warning", "Maximum file size and font-embedding requirements are not stated on the verified Ingram pages.");
  }
  if (o.blurbFits === false) add("blocker", "The back-cover blurb does not fit above the barcode area at a readable size. Shorten it.");
  if (o.frontPpi && o.frontPpi < 300) add("warning", `Front artwork is about ${Math.round(o.frontPpi)} ppi at this trim size; publishers want 300 ppi. It will look softer in print. Use higher-resolution artwork if available.`);
  add("warning", "Barcode: leave the marked area clear. KDP/IngramSpark add one if you don't supply it. IngramSpark states 1.75 x 1 in; KDP's size was not verified here.");
  add("warning", "Manual checks: spine alignment against the publisher's template, text legibility, subject cropping.");
  return out;
}
