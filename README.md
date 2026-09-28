# Kettlebell Family Trainer

A mobile-first web app that lets one household follow kettlebell workouts, get guided through sessions, log results, and track progress.

- **Today** shows the suggested workout from the weekly rotation, your streak, and progression suggestions. You can swap to any other workout.
- **Session player** walks through the warm-up and main work step by step. It has a rest timer, an EMOM interval timer that beeps each minute, and big tap targets for logging reps and weight. It keeps the screen awake while you train.
- **Library** has every workout and exercise with steps, form cues, and common mistakes. You can filter it to kid-safe content.
- **Progress** shows your streak, a calendar heatmap, sessions and swings per week, benchmark trends, bell history, and bodyweight and waist.
- **Family** is where you add and edit athletes, bells, and equipment, and invite the second adult.
- **Kid mode** turns on automatically when a kid profile is active. It uses larger buttons, simpler copy, and only kid-safe content, shows badges, and reminds kids that an adult should supervise.

Stack: Vite, React, TypeScript, Tailwind CSS, Supabase (Postgres, Auth, RLS), Recharts, and React Router (`HashRouter`). It is hosted on GitHub Pages.

## Where data lives

All workout data lives in Supabase. The phone keeps no workout data, no offline cache, and no local copies. If the network is down, the app says so and does not queue anything. A finished session stays on screen so you can press **Try saving again** once you're back online.

The only thing that may be stored on the device is the Supabase auth session token. See [`PERSIST_SESSION`](#the-persist_session-flag).

Workout and exercise content is versioned in the repo as JSON:

- `src/content/exercises.json`
- `src/content/workouts.json`

Edit those files and push. `npm test` checks that every referenced exercise exists and that kid-safe workouts only use kid-safe exercises.

---

## 1. Create the Supabase project

1. Sign in at <https://supabase.com> and click **New project**. Pick a name, a database password, and a region.
2. When it's ready, open **Project Settings → API** and copy:
   - the **Project URL**, which becomes `VITE_SUPABASE_URL`
   - the **anon public** key, which becomes `VITE_SUPABASE_ANON_KEY`. This key is public by design. Security comes from Row Level Security.
3. Go to **Authentication → Providers → Email** and make sure Email is enabled. Keep **Confirm email** on. Invites are only claimed by confirmed addresses, so nobody can join your household by signing up with your partner's email.
4. Go to **Authentication → URL Configuration** and set **Site URL** to your GitHub Pages URL, for example `https://<user>.github.io/<repo>/`. Confirmation emails link there.

## 2. Run the migrations

The SQL lives in `supabase/migrations/`:

| File | What it does |
| --- | --- |
| `20260928000000_initial_schema.sql` | Tables, `is_household_member()`, and RLS on every table |
| `20260928000100_household_bootstrap.sql` | `ensure_household()`, which creates the household on first sign-up or claims an invite |
| `20260928000200_lock_down_function_grants.sql` | Removes the default `anon` permission to run these functions |
| `20260928000300_athlete_custom_rotation.sql` | Adds an optional per-athlete weekly plan (`athletes.custom_rotation`) |

You can run them in either of two ways.

**Option A: Supabase CLI**

```bash
npm i -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B: SQL editor.** Open **SQL Editor** in the dashboard and run each file in order. Paste the contents, then click **Run**.

### How the household gets created

You don't have to seed anything by hand. After someone signs in, the app calls `ensure_household()`:

1. If they already belong to a household, it uses that one.
2. If there is a pending invite for their confirmed email, it adds them to that household as an `adult`.
3. Otherwise it creates a new household, using the name entered at sign-up, and makes them its `owner`.

## 3. Set the GitHub secrets

In the GitHub repo, open **Settings → Secrets and variables → Actions**.

- **Secrets** tab → **New repository secret**:
  - `VITE_SUPABASE_URL`: the project URL
  - `VITE_SUPABASE_ANON_KEY`: the anon key
- **Variables** tab (optional): add `PERSIST_SESSION` = `false` to turn off the saved login. See below.

## 4. Enable GitHub Pages through Actions

1. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Push to `main`. The `Deploy to GitHub Pages` workflow (`.github/workflows/deploy.yml`) runs the tests, builds the app with your secrets, and publishes `dist/`.
3. The site appears at `https://<user>.github.io/<repo>/`. The app uses `HashRouter` and a relative base path, so deep links like `#/progress` work on Pages without extra configuration.

## 5. First sign-in and inviting the second adult

1. **First adult (owner):** open the site, choose **Create account**, enter an email, a password, and an optional household name, then confirm the email and sign in. The household is created automatically.
2. Open **Family** and add the athletes: yourself, the other adult, and the kids. Kids don't log in. They are profiles an adult logs sessions for.
3. Still on **Family**, go to **Invite the other adult** and enter the second adult's email.
4. **Second adult:** open the site, choose **Create account** with that exact email, leave the household name blank, then confirm the email and sign in. They join your household automatically.

Always send the invite first. If the second adult signs up before being invited, they get their own empty household. To fix that, delete their row from `household_members` and their new household in the Supabase dashboard, then have them sign in again after the invite exists.

## The `PERSIST_SESSION` flag

The flag is defined in `src/config.ts`. It defaults to `true` and can be overridden at build time with `VITE_PERSIST_SESSION`, or with the `PERSIST_SESSION` Actions variable.

| Value | Behavior |
| --- | --- |
| `true` (default) | Supabase keeps **only its auth session token** in browser storage, so you stay signed in between visits. |
| `false` | The client is created with `persistSession: false`. **Nothing at all** is stored on the device, and you sign in each time you open the app. |

The app never uses `localStorage`, `sessionStorage`, or IndexedDB for anything else. Even the selected athlete lives only in memory.

---

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:5173
npm test                     # unit tests (rotation, streaks, progression, content)
npm run build
```

## How the app works

### Weekly rotation (`src/lib/rotation.ts`)

Week 1 starts with the athlete's first logged session.

- **Weeks 1–2 (everyone):** Foundation on Mon, Wed, and Fri, and Recovery on the other days.
- **Adults, from week 3:** Mon Joe Rogan · Tue Swing EMOM · Wed Recovery · Thu Joe Rogan · Fri Simple & Sinister · Sat Family circuit · Sun rest or walk. Athletes with no pull-up bar and no dip bars get **Joe Rogan (podcast version)** on Mon and Thu instead, since it only needs a kettlebell.
- **Kids, from week 3:** only Family circuit, Recovery, and Foundation. Mon Foundation · Tue Recovery · Wed Family · Thu Recovery · Fri Foundation · Sat Family · Sun rest.

**Own weekly plan:** in **Family → Edit**, turn on **Use my own weekly plan** and pick a workout (or rest) for each day. It replaces the default rotation, including the two intro weeks. Kids can only pick kid-safe workouts.

### Streaks (`src/lib/streak.ts`)

A streak counts consecutive days with a completed session, and Recovery counts. A planned rest day (Sunday) doesn't break a streak. The day in progress doesn't break it either until the day is over. Kid badges unlock at 3, 7, 14, and 30 days.

### Progression (`src/lib/progression.ts`)

A suggestion appears when an athlete hits every target rep for an exercise, circuit, or EMOM, with RPE ≤ 7, in the two most recent sessions of the same workout. The suggestions come in this order:

1. **Add a set or round**, up to the workout's max (for example, Joe Rogan 3 → 5 rounds).
2. **Shorten rest** by 15 s at a time, down to the workout's minimum. The rest actually used is logged per set in `set_logs.rest_sec`.
3. **Move to the next available bell** from the athlete's bells.

Suggestions show on Today, on the session start screen (with **Apply**), and on the finish screen. They are never forced.

### Schema

The schema follows the spec, with two additions:

- `household_invites`, for the invite flow.
- `set_logs.rest_sec`, for the rest-based progression step.
