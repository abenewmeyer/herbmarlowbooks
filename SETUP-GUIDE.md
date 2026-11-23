# Setup guide - v3.1 (updated 2026-11-23)
**Accounts for this build:** GitHub `dgaftw-cebu-2027` (repo `herbmarlowbooks`) and the Supabase project **"dgaftw-cebu-2027's Project"**. The earlier `abenewmeyer` GitHub repo and the first Supabase project are no longer used; users and data from them do not carry over.

# Setup guide (no coding, nothing installed on your computer)

You will need accounts at: GitHub (done), Supabase (you have one), Vercel (you have one), Groq (new, free), Hugging Face (new, free).
Total time: about 30-40 minutes. Do the steps in this order.

## PART 1 - Put the code in GitHub (pick ONE route)
**v3.1 - no folders needed.** Dragging folders onto GitHub's upload page silently skipped `src`, `public` and `supabase`, which caused Vercel's error "Couldn't find any `pages` or `app` directory". The code is now packed into ONE file, `app-bundle.zip`, that unpacks itself during the Vercel build. Use `upload-these-files.zip` (11 flat files, no folders) and upload them all. Re-uploading a file with the same name replaces it.


### Route A - drag and drop in the browser (easiest, NO token needed)
1. Extract WITHOUT right-clicking (Explorer may freeze). In PowerShell: `cd $env:USERPROFILE\Downloads` then `mkdir hmb` then `tar -xf .\herbmarlowbooks-v3.zip -C .\hmb`. Open the `hmb` folder; the files are directly inside it (no extra folder).
2. Go to https://github.com/dgaftw-cebu-2027/herbmarlowbooks and click **Add file > Upload files**.
3. Select everything inside the `hmb` folder (Ctrl+A) and drag it onto the GitHub page. Wait until every file shows.
   Make sure the `src` and `supabase` folders came along (GitHub shows them as paths like `src/app/page.tsx`).
4. At the bottom click **Commit changes**. (This replaces the README you created - that is fine.)

### Route B - PowerShell (needs Git, and a token if Windows asks for a password)
Open PowerShell and run these one at a time:
```
winget install --id Git.Git -e
```
Close and reopen PowerShell, then:
```
cd $env:USERPROFILE\Downloads
mkdir hmb
tar -xf .\herbmarlowbooks-v3.zip -C .\hmb
cd .\hmb
git init
git config user.name "Darren Allridge"
git config user.email "darrenallridge@gmail.com"
git add .
git commit -m "Initial build"
git branch -M main
git remote add origin https://github.com/dgaftw-cebu-2027/herbmarlowbooks.git
git push -u origin main --force
```
(`--force` is safe here because the repo only contains the README you created.) A browser window usually opens for GitHub sign-in. If it asks for a password instead, paste your **token** (below), not your GitHub password.

### How to create a GitHub token (PAT) - why you couldn't find it
The setting is hidden at the very bottom of the left menu, and it is on your PROFILE settings, not the repo's.
1. Sign in as the account that owns the repo, then open this link directly: https://github.com/settings/personal-access-tokens/new
   (Or: click your profile picture (top right) > **Settings** > scroll to the very bottom of the left sidebar > **Developer settings** > **Personal access tokens** > **Fine-grained tokens** > **Generate new token**.)
2. Token name: `herbmarlowbooks`. Expiration: 30 days.
3. Repository access: **Only select repositories** > choose `herbmarlowbooks`.
4. Repository permissions > **Contents: Read and write**. Leave the rest alone.
5. Click **Generate token** and copy it NOW (it is shown once). Treat it like a password: never paste it into the chat, the repo, or a file.

## PART 2 - Supabase (database + login + private storage)
1. Use the project **dgaftw-cebu-2027's Project** (already created). If it was paused, open it and click **Restore**.
2. Left menu **SQL Editor > New query**. Open `supabase/schema.sql` (in the zip, or the standalone `schema.sql` file), paste ALL of it, click **Run**. You should see "Success". It is safe to run again, so re-running after an update is fine. It includes the new `designs` table for saved designs.
3. **Authentication > Sign In / Providers** (or "Providers") > turn OFF **Allow new users to sign up**. (Important: the app's keys are public-facing, so this stops strangers creating accounts and using your free quota.)
4. **Authentication > Users > Add user > Create new user**. Create each of these, tick **Auto Confirm User**:
   - herbmarlow020@gmail.com
   - hcmarlow@yahoo.com
   Temporary password for both: `123456789`
   Please make Dr. Marlow change it at first login (the app shows a banner and a "Password" page). It is a very weak password - consider giving him a stronger one.
   (Add your own email the same way if you want your own login; each login only sees its own books.)
5. **Get your three Supabase values** (the dashboard has changed: there is no longer a Settings > API page):
   - **Project URL:** click the green/primary **Connect** button at the top of your project, pick any framework (for example Next.js). The dialog shows the **URL** and the **publishable key**. Copy the URL (it looks like `https://abcdxyz.supabase.co`).
   - **Publishable key** (starts with `sb_publishable_`): on the same Connect dialog, or in **Settings (gear, bottom-left) > API Keys**. This is the one that goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It is safe to be visible in the browser.
   - **Secret key** (starts with `sb_secret_`): **Settings > API Keys**, in the **Secret keys** section (click the eye/copy icon, or **Create new secret key**). This goes ONLY in `SUPABASE_SERVICE_ROLE_KEY`. Never anywhere else.
   - If you only see old-style keys, open the **Legacy API keys** tab: `anon` = publishable, `service_role` = secret.
   - **Mixed up the keys?** If a secret key (`sb_secret_...` or `service_role`) was ever placed in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the site was deployed, treat it as leaked: it was published inside the website's code and it bypasses all security. In Settings > API Keys create a NEW secret key, put the new one in `SUPABASE_SERVICE_ROLE_KEY` in Vercel, then delete the old secret key. Do this before Dr. Marlow uses the site.

## PART 3 - Free AI keys (no card needed on the free plans)
Keep a note file open and paste each value into it as you go. Never paste any key into chat or into GitHub.

**Groq (text AI) -> `GROQ_API_KEY`**
1. Go to https://console.groq.com/keys and sign up / sign in (Google or email).
2. Click the button to create a new API key, give it a name such as `herbmarlowbooks`, and create it.
3. Copy the key immediately (it is usually shown only once). If the model fails later, check Groq's current free model list and set `GROQ_MODEL` in Vercel.

**Hugging Face (cover art) -> `HF_TOKEN`**
1. Go to https://huggingface.co and sign up / sign in. Confirm your email if asked.
2. Open https://huggingface.co/settings/tokens (profile picture > Settings > **Access Tokens**).
3. Click **New token**. Choose the **Read** type, name it `herbmarlowbooks`, and create it.
4. Copy the token (starts with `hf_`). The page does not say which type is required to call Spaces; Read is the standard choice. If the first image attempt reports an authorization error, tell Darren/Claude and create a fine-grained token instead.

**CRON_SECRET (a password you invent)**
There is nothing to sign up for. It is a long random string that stops strangers from triggering the monthly check. In PowerShell run:
```
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
```
and copy the 64-character result. Save it in your notes.

## PART 4 - Vercel (publishes the website)
1. vercel.com > sign in (use "Continue with GitHub" and sign in as `dgaftw-cebu-2027`) > **Add New... > Project**.
2. Find `herbmarlowbooks` in the list and click **Import**. (If it is missing, click the link to adjust GitHub permissions and allow the repo.) Leave all build settings as they are; Vercel detects Next.js.
3. On the configure screen, look for a collapsed section named **Environment Variables** and open it. If you cannot find it, click **Deploy** anyway (the first build may fail or the site may not work - that is fine) and use step 4.
4. **Adding variables to an existing project (the dependable way):** dashboard > click your project > **Settings** (top tabs) > **Environment Variables** (left sidebar). In the **Add New** form enter a **Name** and a **Value**, leave all environments ticked (Production, Preview, Development), and click **Save**. Repeat once for each row:

| Name | Value comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (Connect dialog) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **publishable** key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret** key (`sb_secret_...`) |
| `GROQ_API_KEY` | Groq key |
| `HF_TOKEN` | Hugging Face token (`hf_...`) |
| `CRON_SECRET` | the string you generated |

   Optional: `DAILY_IMAGE_LIMIT` (default 6), `DAILY_TEXT_LIMIT` (default 300), `GROQ_MODEL`.
   Paste values with no quotes and no spaces before or after. Check each name letter by letter.
5. **Redeploy** (required - changes only apply to new deployments): **Deployments** tab > the three dots at the right of the latest deployment > **Redeploy**.
6. When it shows Ready, click **Visit** to open the site. Copy that address.
7. In Supabase > **Authentication > URL Configuration**, set **Site URL** to that address and save.
8. Vercel's free Hobby plan is for personal, non-commercial use. If the books are sold, check Vercel's current terms.

## PART 5 - First test (a short PDF is best)
1. Sign in with Dr. Marlow's email and the temporary password.
2. Create a book > tick the consent box > upload a small text-based PDF/DOCX > Analyze > review the brief > approve > describe your cover vision > Create concepts.
3. Click **Generate the 3 covers**. If an image fails with an endpoint error, upload your own art in that slot (the app keeps working) and tell the developer: the Hugging Face Space endpoint was read from its public code but has not been test-called yet.
4. Open **Guide > Check publisher pages now** once. Some publisher pages may show "inaccessible" if they require JavaScript; that is reported honestly, not hidden.

## Daily limits
The "Cover generations left today" counter is an app-side safety guard shared by everyone using this site (one free image account). Default 6 per UTC day; change `DAILY_IMAGE_LIMIT` in Vercel to match what Hugging Face actually allows you. Free text AI: 12,000 tokens/minute on Groq's free tier, so a full book takes 10-15 minutes and pauses by itself.

## Monthly updates
Vercel runs a scan on the 1st of every month (03:00 UTC). It compares the publisher pages with the last snapshot and flags changes on the Guide page. It never edits the rules automatically.

## Using the exported files
Download the ZIP in step 5 of the studio. KDP ebook: upload `cover.jpg` as the new cover. KDP paperback: upload the wrap PDF. IngramSpark: the wrap PDF is RGB and must be converted to CMYK / PDF/X-1a before upload. Always use each publisher's own previewer before submitting.

## What is new in v3
- **Saved designs:** the design section can keep named versions (type, colors, print settings, chosen cover) and reopen them later.
- **How to use** button in the top bar: an illustrated walkthrough for Dr. Marlow (also provided as `Dr-Marlow-Walkthrough.pdf`).
- If you ran an older `schema.sql`, run the current one again to add the `designs` table.

## Troubleshooting a failed Vercel build
- **"Couldn't find any `pages` or `app` directory"**: the `src` folder is not in GitHub. Upload `app-bundle.zip` (and `unpack-bundle.mjs`, `package.json`) to the repo root; the build unpacks it. The build log will say `[prebuild] unpacked 27 files`.
- **"[prebuild] ERROR ... app-bundle.zip was not found"**: that file did not upload. Upload it to the repo root (not inside a folder).
- After any change in Vercel's Environment Variables, press **Redeploy**.
- **Check your settings:** open `https://YOUR-SITE/api/health`. It lists which settings are missing and warns about mix-ups such as a secret key in the anon slot. It never shows values.

## Security note (v3.1)
Next.js was upgraded from 14.2.35 to 16.4.6 because 14.x has known critical advisories with no 14.x fix; `npm audit` reports 0 vulnerabilities for the shipped dependencies.

## Updating the live site later (no GitHub needed)
Your site is deployed from PowerShell with the Vercel CLI. To publish a new version: download the new `app-bundle.zip`, copy it over the old one in `Downloads\hmb2`, then run:
```
cd $env:USERPROFILE\Downloads\hmb2
npx vercel --prod
```
Environment variables stay saved in Vercel. CLI deployments are not tied to a GitHub commit, so the project Overview page can lag; the **Deployments** tab is the reliable place to see them.

## What is new in v3.2
- **Drop in your books:** one or many PDF, Word (.docx) or EPUB files at once. Each becomes a book automatically (title from the file name, author prefilled). No "create a book" step.
- **Your books:** a searchable list with a status tag per book; editable title and author.
- **PDF page count** is prefilled into the print settings for the cover wrap (confirm it matches the published paperback).

## PART 6 - Keep GitHub in sync with the live site (terminal, no web upload)
`npx vercel --prod` does NOT touch GitHub. Do this once to put the real project (with proper folders) into the repo, and again after every update.
**Which repo?** Use the one your Vercel project is connected to (Vercel project > Settings > Git). Below uses `abenewmeyer/herbmarlowbooks`; for the other repo, swap the URL and sign in as that GitHub account when asked.

1. Put the NEW `unpack-bundle.mjs` and `app-bundle.zip` into `Downloads\hmb2` (replace the old ones - the old unpack file needs a library that is not installed there).
2. In PowerShell (if `git --version` says "not recognized", run `winget install --id Git.Git -e`, then close and reopen PowerShell):
```
cd $env:USERPROFILE\Downloads\hmb2
node unpack-bundle.mjs
@"
node_modules
.next
.env
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
app-bundle.zip
"@ | Set-Content .gitignore
git init
git config user.name "Darren Allridge"
git config user.email "darrenallridge@gmail.com"
git add .
git status --short
```
3. **Look at the list `git status` printed. It must NOT contain `.env.local`, `.vercel` or `app-bundle.zip`** (they hold private tokens; the repo is public). If it does, stop and ask. Otherwise:
```
git commit -m "Full project source"
git branch -M main
git remote add origin https://github.com/abenewmeyer/herbmarlowbooks.git
git push -u origin main --force
```
`--force` replaces the repo's old contents (only files generated for this project). A browser window opens for GitHub sign-in: choose the account that owns the repo. If it asks for a password, paste a fine-grained token with **Contents: Read and write** for that repo (see Part 1). A 403 / "permission denied" means you are signed into the wrong GitHub account; remove the saved github.com entry in Windows Credential Manager (Windows Credentials) and try again.
4. If your Vercel project is connected to that repo, every push now deploys automatically and you no longer need `npx vercel --prod`.

**Each future update:** copy the new `app-bundle.zip` over the old one in `hmb2`, then:
```
cd $env:USERPROFILE\Downloads\hmb2
$env:FORCE_UNPACK=1; node unpack-bundle.mjs
git add .
git status --short
git commit -m "Update"
git push
```
then `npx vercel --prod` only if the project is not connected to the repo.
