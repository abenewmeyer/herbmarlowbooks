# Herb Marlow Books - Cover & Blurb Studio

Private web tool: upload a manuscript (PDF or Word) -> AI reads it -> three cover options + back-cover blurbs + marketing intel -> typeset title/author -> download publisher-ready cover files (KDP ebook, KDP paperback wrap, IngramSpark wrap) -> you upload them to the publisher sites yourself.

Free-tier stack: Vercel (website) + Supabase (login, database, private files) + Groq (text AI) + Hugging Face FLUX.1-schnell Space (cover art).
Interior typesetting and EPUB production are NOT included (a separate phase). Nothing is ever uploaded to a publisher automatically.

**Full step-by-step setup is in `SETUP-GUIDE.md`.** Version 3.1 (2026-11-23). Next.js 16. `app-bundle.zip` + `unpack-bundle.mjs` let the project deploy from flat file uploads (see SETUP-GUIDE). Includes saved designs and an in-app walkthrough (`/start.html`).

## What is verified vs. not (checked 2026-11-03)
Verified from official pages: KDP ebook cover rules, KDP paperback cover rules + spine formulas, IngramSpark print cover rules.
NOT verified / unknown (left unknown in the app, never guessed): KDP barcode size, IngramSpark max file size and font-embedding rules, IngramSpark ebook cover rules, KDP/Ingram AI-disclosure rules, hardcover.
Known limits: print covers export as RGB (publishers want CMYK; IngramSpark needs PDF/X-1a CMYK - the app flags this); AI art is 1024x1536 so large print trims will be below 300 ppi (the app warns).
