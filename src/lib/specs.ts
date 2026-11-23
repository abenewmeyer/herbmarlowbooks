// Publisher profiles. Values come ONLY from official pages read on the dates shown. null = not verified.
export const VERIFIED_ON = "2026-11-03";
export const VERIFIED_BY = "Automated research session (Claude) reading official pages; owner/human review still pending.";

export type SpecSource = { key: string; label: string; url: string; host: string };
export const SOURCES: SpecSource[] = [
  { key: "kdp_ebook", label: "KDP eBook cover guidelines", url: "https://kdp.amazon.com/en_US/help/topic/G200645690", host: "kdp.amazon.com" },
  { key: "kdp_paperback", label: "KDP paperback cover guidelines", url: "https://kdp.amazon.com/help/topic/G201953020", host: "kdp.amazon.com" },
  { key: "kdp_calc", label: "KDP cover calculator / template generator", url: "https://kdp.amazon.com/cover-calculator", host: "kdp.amazon.com" },
  { key: "ingram_cover", label: "IngramSpark Cover File Creation", url: "https://help.ingramspark.com/hc/en-us/articles/35306346735245-Cover-File-Creation", host: "help.ingramspark.com" },
  { key: "ingram_files", label: "IngramSpark file requirements for print books", url: "https://www.ingramspark.com/blog/file-requirements-for-print-books", host: "www.ingramspark.com" },
];

export const KDP_EBOOK = {
  id: "kdp_ebook", label: "Amazon KDP - eBook cover", verifiedAt: VERIFIED_ON, sourceKey: "kdp_ebook",
  formats: ["JPEG (.jpg/.jpeg)", "TIFF (.tif/.tiff)"],
  idealPx: { w: 1600, h: 2560 }, minPx: { w: 625, h: 1000 }, maxPx: 10000,
  minRatio: 1.6, maxBytes: 50 * 1024 * 1024, colorMode: "RGB",
  notes: [
    "Ideal 2,560 px tall x 1,600 px wide; minimum 1,000 x 625; never above 10,000 px on either side; file under 50 MB.",
    "Height-to-width ratio of at least 1.6:1.",
    "Page states 72 dpi but also recommends 300 PPI for best results (internally inconsistent - pixel dimensions are what matter).",
    "Light/white backgrounds may disappear on the page: a thin medium-gray border is recommended.",
    "You must hold all rights to the cover content. Check KDP's current AI-generated-content disclosure rules in your KDP account (not verified here).",
  ],
};

export const KDP_PAPERBACK = {
  id: "kdp_paperback", label: "Amazon KDP - paperback full-wrap cover", verifiedAt: VERIFIED_ON, sourceKey: "kdp_paperback",
  bleedIn: 0.125, safeIn: 0.125, minTextPt: 7, maxBytes: 650 * 1024 * 1024, recommendedBytes: 40 * 1024 * 1024,
  spinePerPage: { bw_white: 0.002252, bw_cream: 0.0025, color_premium: 0.002347, color_standard: 0.002252 } as Record<string, number>,
  spineLabels: { bw_white: "Black & white ink, white paper", bw_cream: "Black & white ink, cream paper", color_premium: "Premium color", color_standard: "Standard color" } as Record<string, string>,
  spineTextMinPages: 80, // KDP page says both "at least 79" and "more than 79"; Cover Creator requires 80 -> use 80 (conservative)
  notes: [
    "Single PDF: back cover + spine + front cover as one flattened image; embed fonts; no locked/encrypted files.",
    "300 DPI minimum, CMYK recommended, sized at 100%. This app exports RGB - see warnings.",
    "Bleed 0.125 in on top, bottom and outside edges; keep text 0.125 in inside trim and out of the spine area.",
    "Spine width = page count x paper factor (see table). Spine text needs 0.0625 in clearance each side; none under ~79-80 pages.",
    "Barcode: KDP adds one if you omit it - keep the barcode area clear. Barcode size was not stated on the verified page; confirm in KDP's template.",
    "Always confirm against KDP's own cover calculator/template for your exact trim, paper and page count.",
  ],
};

export const INGRAM_PRINT = {
  id: "ingram_print", label: "IngramSpark - paperback cover (PDF)", verifiedAt: VERIFIED_ON, sourceKey: "ingram_cover",
  bleedIn: 0.125, typeSafetyIn: 0.25, spineSafeWideIn: 0.0625, spineSafeNarrowIn: 0.03125, spineWideThresholdIn: 0.35,
  spineTextMinPages: 48, barcodeAreaIn: { w: 1.75, h: 1 }, resolutionPpi: 300, colorSpace: "CMYK", pdfStandard: "PDF/X-1a:2001",
  notes: [
    "One PDF with front + back + spine, uploaded separately from the interior. PDF/X-1a:2001 recommended; CMYK; 300 ppi; spot colors converted to CMYK.",
    "Bleed 0.125 in on all four sides (hardcover case laminate needs a 0.625 in wrap - NOT supported by this app).",
    "Type safety 0.25 in minimum from trim. No spine text under 48 pages. Spine safe margin 0.0625 in (spine >= 0.35 in) or 0.03125 in (narrower).",
    "Text 24 pt or smaller must be 100% black (CMYK 0/0/0/100). Barcode is mandatory; if you don't supply one IngramSpark adds it. Keep 1.75 x 1 in clear.",
    "Spine width and exact dimensions come from IngramSpark's free Cover Template Generator - enter them manually; this app does not compute Ingram spine widths.",
    "Maximum file size and font-embedding rules were NOT stated on the verified pages (unknown).",
    "IngramSpark eBook cover rules were not verified - no Ingram eBook profile is offered.",
  ],
};

export const PROFILES = [KDP_EBOOK, KDP_PAPERBACK, INGRAM_PRINT];
