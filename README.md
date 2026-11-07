# Quiz Portal – randomised, timed quizzes for ~50 students

Upload study material (PDF/DOCX) → AI writes 15 multiple-choice questions → you review and edit them → publish → students take a randomised, timed quiz → scores are saved permanently and you download them as CSV or Excel.

**Stack:** Next.js (frontend + backend) · Tailwind CSS · Supabase (database + admin login) · Claude API (question generation) · Vercel (hosting)

---

## Contents

1. [How it works](#1-how-it-works)
2. [Project map](#2-project-map)
3. [Set up on your computer](#3-set-up-on-your-computer)
4. [Deploy to Vercel](#4-deploy-to-vercel)
5. [Running a quiz (checklist)](#5-running-a-quiz-checklist)
6. [Security design](#6-security-design)
7. [Limits and tips](#7-limits-and-tips)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. How it works

```
Admin uploads PDF/DOCX ─► server extracts text ─► Claude API ─► 15 MCQs saved as a DRAFT
Admin reviews / edits / sets duration ─► Publish
Student types username ─► server creates an ATTEMPT (own random order, deadline saved on the server)
Student answers (each click auto-saved) ─► Submit, or timer reaches 0 ─► server grades ─► score stored
Admin dashboard ─► live results ─► download CSV / Excel
```

**Key idea:** the browser is never trusted. Correct answers, the deadline and the grading all live on the server.

## 2. Project map

```
quiz-app/
├── supabase/schema.sql          ← database tables (you paste this into Supabase once)
├── .env.example                 ← list of secret settings you must fill in
├── next.config.mjs              ← Next.js settings
├── src/
│   ├── app/
│   │   ├── page.js              ← student home page (enter username)
│   │   ├── quiz/[token]/page.js ← the quiz screen: timer, questions, result
│   │   ├── admin/page.js        ← admin dashboard
│   │   ├── admin/login/page.js  ← admin login
│   │   └── api/                 ← the BACKEND (each route.js is one endpoint)
│   │       ├── quiz/            ← student endpoints: info, start, attempt, answer, submit
│   │       └── admin/           ← admin endpoints (all require login): generate, quizzes,
│   │                              results, export, attempts, login/logout/me
│   ├── components/admin/        ← admin screens (list, new quiz, editor, results)
│   └── lib/                     ← shared server code
│       ├── logic.js             ← shuffling, grading, validation (pure functions)
│       ├── quiz.js              ← saving/grading attempts in the database
│       ├── ai.js                ← asks Claude for the 15 questions
│       ├── extract.js           ← reads text out of PDF / DOCX
│       ├── auth.js              ← admin login check
│       ├── supabase.js          ← database connection
│       ├── csv.js, format.js    ← export + date helpers
│       └── http.js, errors.js   ← small API helpers
```

In Next.js a file at `src/app/api/quiz/start/route.js` automatically becomes the URL `/api/quiz/start`, and `src/app/admin/page.js` becomes `/admin`.

## 3. Set up on your computer

### 3.1 Install the tools
- **Node.js (LTS, version 20 or newer):** https://nodejs.org
- **Git:** https://git-scm.com/downloads
- **VS Code** (optional but recommended): https://code.visualstudio.com

Check in a terminal: `node -v` and `git --version`.

### 3.2 Install the project
Open a terminal **inside this folder** and run:

```bash
npm install
```

### 3.3 Create the Supabase project (database + admin login)
1. Go to https://supabase.com → **New project**. Choose a strong database password and a region close to your students (e.g. Mumbai). Wait until it finishes creating.
2. **Create the tables:** left menu **SQL Editor → New query**. Open `supabase/schema.sql` from this project, copy everything, paste it, click **Run**. You should see "Success".
3. **Create your admin account:** **Authentication → Users → Add user → Create new user**. Enter your email and a strong password and keep "Auto Confirm User" ticked.
4. **Stop strangers signing up:** **Authentication → Sign In / Providers** (older dashboards: *Settings*) and switch **off** "Allow new users to sign up". (The app only lets emails in `ADMIN_EMAILS` into `/admin` anyway, but this is an extra lock.)
5. **Copy your keys:** **Project Settings → API** (or **API Keys**). You need:
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the public key: called **anon** (older) or **publishable** (newer)
   - the secret key: called **service_role** (older) or **secret** (newer) – click *Reveal*. **Never share it or put it in public code.**

   If your dashboard shows both "new" and "legacy" keys and one type gives errors, try the other type.

### 3.4 Get a Claude API key
Create one at https://console.anthropic.com (API keys). Add a small amount of credit. Generating one quiz costs a few cents at most. This is billed separately from the Claude chat app.

### 3.5 Create your secrets file
Copy the example file to `.env.local`:

```bash
# Mac / Linux
cp .env.example .env.local

# Windows (PowerShell)
copy .env.example .env.local
```

Open `.env.local` in VS Code and fill in every value:

| Name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_ANON_KEY` | the anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key |
| `ADMIN_EMAILS` | the email you used in step 3.3 (comma-separate several) |
| `ANTHROPIC_API_KEY` | your Claude API key |

`.env.local` is listed in `.gitignore`, so Git will never upload it. **Never commit your keys.**

### 3.6 Run it

```bash
npm run dev
```

- Students' page: http://localhost:3000
- Admin: http://localhost:3000/admin/login

Press `Ctrl + C` to stop. After changing `.env.local` you must stop and start again.

### 3.7 Test everything once
1. Log in at `/admin/login`.
2. **New quiz from study material** → upload a small PDF/DOCX → wait up to a minute → review the 15 questions → **Save & publish**.
3. Open http://localhost:3000 in a private/incognito window, enter a username, take the quiz, submit.
4. Back in admin → **Results** tab → check the score → try **Download CSV / Excel**.
5. Click **Delete all attempts** so your test data is gone.

## 4. Deploy to Vercel

1. **Push the code to GitHub** (from this folder):
   ```bash
   git add .
   git commit -m "Quiz portal"
   git push
   ```
2. Go to https://vercel.com → **Add New… → Project** → pick your GitHub repo → **Import**. Vercel detects Next.js automatically.
3. Before clicking Deploy, open **Environment Variables** and add the same five names and values from `.env.local`.
4. Click **Deploy**. After about a minute you get a URL like `https://quiz-app-xxxx.vercel.app`. **That is the link you give students.** The admin page is at `/admin/login` on the same address.
5. Repeat the test from 3.7 on the live site.

If you change an environment variable later: Vercel → Project → Settings → Environment Variables, then **Redeploy**.

## 5. Running a quiz (checklist)

**A day or two before**
- Open your Supabase project dashboard once (free projects pause after about a week of no activity).
- Create the quiz, review all 15 questions carefully, check each correct answer, set the duration, **Save & publish**.
- Take the quiz yourself, then **Delete all attempts** (this also unlocks editing).

**On the day**
- Share the Vercel link. Students enter a username (tell them to use their real name or roll number so you can recognise them).
- Watch the **Results** tab; it refreshes every 15 seconds.
- A student who loses their session (new phone, cleared browser) shows as "In progress" – use **Reset** on their row so they can start again.

**Afterwards**
- Click **Close quiz** (stops new starts), then **Download Excel/CSV**.
- Students who never pressed submit are graded automatically from their saved answers once their time is over.

## 6. Security design

| Requirement | How it is done |
|---|---|
| Correct answers hidden | Student endpoints never select `correct_index`. Grading is on the server. |
| Server-validated timer | The deadline `expires_at` is saved in the database when the attempt starts. The browser countdown is only a display (and uses the server's clock, not the phone's). Answers saved after the deadline are rejected by the database; a submit more than 10 s late is graded using only answers saved before the deadline. |
| No admin access for students | Every `/api/admin/*` route checks a Supabase login **and** that the email is in `ADMIN_EMAILS`. The login cookie is `httpOnly` and `sameSite=lax`. |
| Database not reachable from browsers | Row Level Security is on with no public policies. Only the server's secret key can read/write. |
| Unique attempt per student | A secret token per attempt, plus a database rule: one attempt per username (case-insensitive) per quiz. |
| No duplicate submissions | The grading update only succeeds while the attempt is "in progress", so double clicks, refreshes and retries cannot grade twice. |
| Refresh-safe | Question order, answers and the deadline are stored in the database; the page reloads them. Each click is auto-saved. |
| Randomisation | Question order and option order are shuffled per student with a secure random generator and stored. |
| CSV safety | Cells starting with `=`, `+`, `-`, `@` are neutralised so spreadsheets can't run them as formulas. |

**Honest limitation:** students log in with a username only (no password), so one student could type another's name before them. That is why usernames are first come, first served and the admin can reset. For high-stakes exams, add a student list or access codes.

## 7. Limits and tips

- **File size:** uploads up to 4 MB (Vercel's request limit). For bigger or scanned (image-only) PDFs, copy the text and paste it into the text box instead.
- **AI quality:** always review the questions. Clear, well-structured material gives the best questions. Long material is trimmed to about 80,000 characters.
- **One live quiz at a time:** publishing a quiz automatically closes any other live quiz.
- **Locked questions:** once any student has started, questions can't be edited (title and duration can). Delete the attempts to unlock.
- **Time zone:** dates show in Indian Standard Time. To change, edit `TIMEZONE` in `src/lib/format.js`.
- **Number of questions:** the quiz uses every question in the quiz (15 when generated). You may add or remove questions in the editor.
- **Free plans:** Supabase free and Vercel Hobby are plenty for 50 students; Vercel Hobby is meant for non-commercial use.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `Missing environment variable: …` | `.env.local` is missing a value, or (on Vercel) the variable wasn't added. Restart / redeploy. |
| Admin login says "Wrong email or password" | The email must be in `ADMIN_EMAILS` **and** exist under Supabase → Authentication → Users with that password. |
| "Something went wrong on the server" | Open the terminal running `npm run dev` (or Vercel → Logs) and read the real error. Most often the schema wasn't run or a key is wrong. |
| "The AI service returned an error" | Check `ANTHROPIC_API_KEY` and that your Anthropic account has credit. |
| "I could not find enough text" | The PDF is probably a scan. Paste the text instead. |
| Generation times out on Vercel | Try less/shorter material. |
| Student: "username already used" | Admin → quiz → Results → **Reset** on that row. |
| `npm install` errors | Make sure Node is version 20 or newer (`node -v`). |
