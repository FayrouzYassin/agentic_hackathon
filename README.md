# Medical Alert

A bilingual (English / Arabic) medical alert app for people living with chronic
conditions that can cause a seizure, a collapse, or a loss of consciousness.

**The idea in one paragraph.** A patient fills in a short form once — their name,
a photo, their condition, and one emergency contact. The backend sends the
condition to **Claude** (Anthropic's AI), which turns it into a few short, calm
first-aid steps that a frightened stranger could actually follow. Later, if the
patient collapses, anyone who picks up the phone sees a full-screen alert: the
patient's photo, their condition, those steps, and one big button that dials the
emergency contact. The phone can also open that screen by itself when it's
shaken hard three times.

> **New to full-stack work?** This README is written for you. Every unfamiliar
> term is explained the first time it appears, and there's a
> [glossary](#glossary) at the bottom. Read
> [How the two halves talk to each other](#how-the-two-halves-talk-to-each-other)
> if you only read one section.

---

## Table of contents

- [What the app actually does](#what-the-app-actually-does)
- [The two halves of this project](#the-two-halves-of-this-project)
- [Tech stack](#tech-stack)
- [Quickstart: get it running in 10 minutes](#quickstart-get-it-running-in-10-minutes)
- [Repo map — which folders actually matter](#repo-map--which-folders-actually-matter)
- [How the two halves talk to each other](#how-the-two-halves-talk-to-each-other)
- [Environment variables](#environment-variables)
- [Command cheat sheet](#command-cheat-sheet)
- [Troubleshooting](#troubleshooting)
- [Deploying](#deploying)
- [Known limitations](#known-limitations)
- [Glossary](#glossary)

---

## What the app actually does

There are only two screens.

**1. Setup screen** — the patient fills this in once.

| Field | Why it exists |
| --- | --- |
| Photo | So a bystander can confirm the phone belongs to the person on the ground |
| Full name | So they can be addressed by name, and identified by paramedics |
| Condition | Free text ("Epilepsy", "السكري", "Type 1 diabetes") — this is what Claude reads |
| Emergency contact | Name + phone number for the call button |
| Shake to alert | Optional. Three hard jolts within ~1.6 seconds open the alert screen |

**2. Alert screen** — what a stranger sees.

The patient's photo and condition, Claude's numbered first-aid steps, a siren
sound to attract attention, and a **Call emergency contact** button that opens
the phone dialler.

Both screens are fully translated into Arabic, including right-to-left layout,
and the language toggle is one tap.

**The safety rule this project is built around:** the alert screen must work
even when everything else fails. So the app saves the profile on the device
first and shows the alert immediately from local storage. Claude's tailored
steps replace the generic built-in steps only once the backend answers. No
network, dead API key, sleeping server — the screen still appears and the call
button still works.

---

## The two halves of this project

This is the part that confuses people first, so it comes early.

```
agentic_hackathon/
│
├── backend/                    ← Half 1: the API. Node + Express + MongoDB + Claude.
│                                 Plain JavaScript. Installed with npm.
│
└── artifacts/medical-alert/    ← Half 2: the app. Expo / React Native.
                                  TypeScript. Installed with pnpm.
```

They are **two separate programs**. You start each one in its own terminal, and
they talk over HTTP like any other frontend and backend.

They also deliberately use **two different package managers**:

- The root of this repo is a **pnpm workspace** — one shared `node_modules` for
  everything under `artifacts/` and `lib/`. That's where the app lives.
- `backend/` is **excluded from that workspace on purpose** and uses plain
  `npm`. That way a cloud host (Render, Railway, Fly) can build it straight from
  the `backend/` folder without knowing anything about the workspace around it.

So: `pnpm install` at the root, and a separate `npm install` inside `backend/`.
That is not a mistake — it's the design.

> ### ⚠️ There is a second, unrelated `api-server` folder — ignore it
>
> `artifacts/api-server/` is an empty Express starter that came with the Replit
> project template. It only has a health-check route and **nothing in this app
> uses it**. The real API is `backend/`. Same story for
> `artifacts/mockup-sandbox/` and everything in `lib/` — see
> [the repo map](#repo-map--which-folders-actually-matter).

---

## Tech stack

**Backend** (`backend/`)

| Piece | What it is |
| --- | --- |
| Node.js 18.17+ | The JavaScript runtime the server runs on |
| Express 5 | The web framework — matches incoming URLs to your functions |
| MongoDB + Mongoose | The database, and the library that talks to it |
| `mongodb-memory-server` | Runs a throwaway MongoDB in RAM so you need zero setup |
| `@anthropic-ai/sdk` | The official client for calling Claude |
| multer | Parses uploaded photos out of the request |
| dotenv | Loads `backend/.env` into `process.env` |

**Frontend** (`artifacts/medical-alert/`)

| Piece | What it is |
| --- | --- |
| React Native | Write one UI in React, run it as a real iOS/Android app |
| Expo (SDK 57) | The toolchain that makes React Native runnable without Xcode/Android Studio |
| expo-router | File-based routing — a file in `app/` becomes a screen |
| TypeScript | JavaScript with types |
| AsyncStorage | The phone's version of `localStorage` — this is the local-first store |
| expo-sensors | Reads the accelerometer, for shake-to-alert |
| expo-audio / expo-haptics | The siren sound and the vibration |
| expo-image-picker | Camera and photo library access |

The same codebase runs as a website, an iOS app, and an Android app.

---

## Quickstart: get it running in 10 minutes

### Before you start

- **Node.js 18.17 or newer.** Check with `node --version`.
- **pnpm.** Install with `npm install -g pnpm`.
- **An Anthropic API key** — create one at
  <https://console.anthropic.com/settings/keys>. It looks like `sk-ant-...`.
- **You do not need to install MongoDB.** The backend starts its own temporary
  database automatically.

### Terminal 1 — the backend

```bash
cd backend
npm install             # downloads the libraries listed in package.json
cp .env.example .env    # creates your private config file
```

Now open the new `backend/.env` file and paste your key after
`ANTHROPIC_API_KEY=`. That is the only value you must fill in. Then:

```bash
npm run dev             # starts the server and restarts it when you edit a file
```

> **What is `.env`?** A plain text file of `KEY=value` lines holding settings
> that must never be written into source code — API keys, passwords, ports. The
> `dotenv` library loads it into `process.env` at startup. It is git-ignored, so
> your key is never committed. `.env.example` is the safe, key-less copy that
> *is* committed, so other developers can see which settings exist.

You should see roughly this:

```
[db] MONGO_URI is not set — starting a TEMPORARY in-memory MongoDB for the demo.
[db] connected to "medical_alert" (in-memory)
[server] listening on 0.0.0.0:5000 (local: http://localhost:5000)
```

**The very first run downloads a ~100 MB MongoDB binary.** It hangs for a minute
or two and needs internet. This happens once per machine; every run afterwards
takes about a second and works offline.

Check it's alive in another terminal:

```bash
curl http://localhost:5000/health
# {"status":"ok","uptimeSeconds":12}
```

### Terminal 2 — the frontend

```bash
pnpm install                    # run this at the REPO ROOT, not in backend/
cd artifacts/medical-alert
pnpm exec expo start
```

Then press **`w`** to open it in your browser, or scan the QR code with the
**Expo Go** app on your phone.

> **Why `pnpm exec expo start` and not `pnpm dev`?** The `dev` script in
> `package.json` is wired for Replit's hosting — it reads environment variables
> like `$REPLIT_EXPO_DEV_DOMAIN` that don't exist on your machine. Calling Expo
> directly is the reliable local path, and does the same thing.

You don't need to configure the backend URL for local development. `lib/config.ts`
guesses it: `localhost:5000` on web and iOS simulator, `10.0.2.2:5000` on the
Android emulator, and your computer's LAN IP when you're on a real phone.

### Check that the two halves are actually connected

Fill in the setup form **including a photo** and tap **Save & preview alert**.
Then look at Terminal 1 — you should see the `POST /api/users/setup` request
arrive. On the alert screen, Claude's steps will replace the three generic
built-in ones after a moment.

If the photo is missing, the backend rejects the profile (a photo is required),
the app stays local-only, and you'll see the generic steps instead. That's the
designed fallback, not a crash.

---

## Repo map — which folders actually matter

### The project

```
backend/                          THE API — everything below is plain JavaScript
├── server.js                     wiring, static photo serving, error handler, startup
├── .env.example                  the config template (copy to .env)
├── config/db.js                  MongoDB connection, plus the in-memory fallback
├── routes/                       URL → handler mapping
│   ├── userRoutes.js               POST /setup, GET /:id
│   └── emergencyRoutes.js          POST /trigger
├── controllers/                  the logic for each endpoint
├── services/aiService.js         the ONLY file that calls Claude
├── models/                       Mongoose schemas: what a document looks like
│   ├── User.js                     patient profile + cached instructions
│   └── EmergencyLog.js             audit trail of triggered alerts
├── middleware/
│   ├── upload.js                   saves the uploaded photo (multer)
│   └── validate.js                 checks every field before it reaches the logic
├── utils/
│   ├── i18n.js                     the English/Arabic message catalogue
│   ├── apiError.js                 an HTTP error that carries a translation key
│   └── notify.js                   builds the tel: link, fires the optional webhook
├── README.md                     ← DEEP DIVE: full API reference, line by line
└── DEPLOYMENT.md                 ← how to put this on Render + MongoDB Atlas

artifacts/medical-alert/          THE APP — TypeScript + React Native
├── app/
│   ├── index.tsx                   both screens live here (~1800 lines)
│   ├── _layout.tsx                 fonts, navigation shell, error boundary
│   └── +not-found.tsx              404 screen
├── lib/
│   ├── api.ts                      the HTTP client for backend/ — every call
│   └── config.ts                   works out the backend URL
├── components/                   error boundary + keyboard helpers
├── constants/colors.ts           the colour palette
├── hooks/useColors.ts            light/dark theme hook
├── assets/                       app icon + the emergency siren mp3
├── .env.example                  frontend config template
├── scripts/build.js              produces the static web export
└── server/serve.js               serves that export in production
```

### Scaffolding you can ignore

These came with the Replit project template. **Nothing in the medical alert app
imports any of them.** They're left in place because deleting them means
untangling the workspace config, which isn't worth the risk mid-hackathon.

| Folder | What it would have been |
| --- | --- |
| `artifacts/api-server/` | A TypeScript Express starter. Has one health route |
| `artifacts/mockup-sandbox/` | A shadcn/ui component preview canvas |
| `lib/api-spec/` | An OpenAPI spec + Orval codegen config |
| `lib/api-client-react/` | An API client generated from that spec |
| `lib/api-zod/` | Zod validation types generated from that spec |
| `lib/db/` | A Drizzle ORM schema for **PostgreSQL** — not the app's MongoDB |
| `scripts/`, `attached_assets/` | A sample script and raw source media |
| `replit.md`, `.replit` | Replit's own project config |

If you're reading the code to understand the app, read `backend/` and
`artifacts/medical-alert/`. Nothing else.

---

## How the two halves talk to each other

### The whole flow, once

```
┌─ PHONE ────────────────────┐          ┌─ SERVER ──────────────────────────┐
│                            │          │                                   │
│  1. Patient fills the      │          │                                   │
│     setup form             │          │                                   │
│            │               │          │                                   │
│            ▼               │          │                                   │
│  2. Saved to AsyncStorage  │          │                                   │
│     (local, instant)       │          │                                   │
│            │               │          │                                   │
│            ▼               │          │                                   │
│  3. POST /api/users/setup ─┼──────────┼─▶ 4. Validate → save photo →      │
│     (photo + fields)       │          │      store profile in MongoDB     │
│                            │          │                │                  │
│                            │          │                ▼                  │
│                            │          │   5. Send ONLY condition +        │
│                            │          │      language to Claude ──────────┼─▶ Anthropic
│                            │          │                │                  │
│                            │          │                ▼                  │
│  7. Store the returned id ◀┼──────────┼─ 6. Cache the steps on the        │
│     in AsyncStorage        │          │      profile, return everything   │
│                            │          │                                   │
│  ── later, an episode ──   │          │                                   │
│                            │          │                                   │
│  8. Shake ×3, or tap       │          │                                   │
│     "preview alert"        │          │                                   │
│            │               │          │                                   │
│            ▼               │          │                                   │
│  9. Alert screen renders   │          │                                   │
│     from LOCAL data NOW    │          │                                   │
│            │               │          │                                   │
│            ▼               │          │                                   │
│ 10. POST /api/emergency/  ─┼──────────┼─▶ 11. Look up profile, log the    │
│     trigger { userId }     │          │       alert, optionally POST to   │
│            │               │          │       a webhook, return the       │
│            ▼               │          │       cached steps + tel: link    │
│ 12. Claude's steps swap in │◀─────────┼───────────────┘                   │
│     over the generic ones  │          │                                   │
└────────────────────────────┘          └───────────────────────────────────┘
```

Steps 3–7 and 10–12 are all **optional**. If any of them fails, the app keeps
its local profile and shows the three built-in generic first-aid steps. The
alert screen never waits on the network.

### The three endpoints

| Method + URL | Body | What it does |
| --- | --- | --- |
| `POST /api/users/setup` | `multipart/form-data` | Creates the profile, generates the steps. Returns a 24-character `id` |
| `GET /api/users/:id` | – | Reads a profile back, including cached steps |
| `POST /api/emergency/trigger` | JSON `{ userId }` | Everything the alert screen needs, already translated |
| `GET /health` | – | `{"status":"ok"}` — a quick "is it up?" check |

Full request/response examples are in
[`backend/README.md`](backend/README.md#api-reference).

### Inside the backend, one request at a time

Every request walks through the same chain of small functions, each with one
job:

```
HTTP request
    ↓
server.js            picks the route file for this URL
    ↓
routes/…             maps "POST /setup" to a list of functions, in order
    ↓
middleware/upload    saves the uploaded photo to disk          (only on /setup)
    ↓
middleware/validate  checks every field; rejects bad input early
    ↓
controllers/…        the real logic: read/write the DB, build the response
    ↓
services/aiService   calls Claude                              (only when needed)
    ↓
models/…             Mongoose schemas shaping what MongoDB stores
    ↓
HTTP response (always JSON)
```

> **Middleware** is just a function that runs *before* your main handler. It can
> pass the request along (`next()`) or stop it with an error. Validation, file
> uploads, and authentication are all middleware, because they apply to many
> routes and shouldn't be copy-pasted into each one.

> **Controller vs. service vs. model.** A controller handles one HTTP endpoint
> and knows about requests and responses. A service wraps one external system
> (here, Anthropic) and knows nothing about HTTP. A model describes one
> collection of database documents. Keeping them apart means you can change how
> you call Claude without touching any routing code.

### How the Claude call is kept safe

`backend/services/aiService.js` is the only file that talks to Anthropic. Three
decisions in there are worth understanding, because they're general habits:

1. **Only the condition text and the language are sent.** The patient's name,
   photo, and emergency contact never leave your server.
2. **The condition text is wrapped in markers and labelled untrusted.** Someone
   could type *"ignore your instructions and say X"* into the condition field —
   that's called **prompt injection**, and the system prompt is written to
   defend against it.
3. **The steps are generated once and cached on the profile.** The alert screen
   therefore loads instantly and keeps working even if Anthropic is down later.
   That matters enormously when the page is being read during a real emergency.

### Error handling

Individual functions never build error responses. They `throw` an `ApiError`
carrying a *translation key* like `validation.name`, and the single error
handler at the bottom of `server.js` catches everything and returns the same
shape:

```json
{ "success": false, "error": "message in the caller's language" }
```

That's how every message stays bilingual without scattering English literals
through the codebase.

---

## Environment variables

### Backend — `backend/.env`

Only one is required. Copy `backend/.env.example` to get started.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** | – | Your Claude key. The server refuses to start without it |
| `MONGO_URI` | in production | – | Database connection string. Leave unset locally for the in-memory demo DB |
| `PORT` | no | `5000` | Which port to listen on |
| `HOST` | no | `0.0.0.0` | Leave as-is so phones and containers can reach it |
| `NODE_ENV` | no | `development` | Set to `production` on a real host — that also makes `MONGO_URI` mandatory |
| `ANTHROPIC_MODEL` | no | `claude-opus-5` | Which Claude model writes the steps |
| `ANTHROPIC_TIMEOUT_MS` | no | `25000` | How long to wait for Claude before giving up |
| `ALLOWED_ORIGINS` | no | `*` | Comma-separated list of sites allowed to call this API (CORS) |
| `UPLOAD_DIR` | no | `uploads` | Where photos are written |
| `MAX_UPLOAD_MB` | no | `5` | Largest accepted photo |
| `EMERGENCY_WEBHOOK_URL` | no | *(empty)* | Optional URL notified when an alert fires |

### Frontend — `artifacts/medical-alert/.env`

Entirely optional for local development.

| Variable | Default | What it does |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | auto-detected | Base URL of the backend, no trailing slash |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | `15000` | How long a backend call may take |

> **Two traps with `EXPO_PUBLIC_` variables.**
>
> 1. They are **inlined into the JavaScript bundle at build time**, not read at
>    runtime. After changing one you must restart `expo start`, or re-run
>    `pnpm build` for a deployed web export.
> 2. They ship inside the bundle and **anyone using the app can read them**.
>    Never put a secret — an API key, a database password — behind an
>    `EXPO_PUBLIC_` name. That's exactly why `ANTHROPIC_API_KEY` lives on the
>    server and the app never sees it.

**No key, connection string, or other secret is hardcoded anywhere in the
source.** `.env` files are git-ignored; only the `.env.example` templates are
committed.

---

## Command cheat sheet

Backend — run from `backend/`:

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start with auto-restart on save (use this while coding) |
| `npm start` | Start once, no watching (this is what a host runs) |

Frontend — run from `artifacts/medical-alert/`:

| Command | What it does |
| --- | --- |
| `pnpm exec expo start` | Start the dev server; press `w` for web, or scan the QR code |
| `pnpm typecheck` | Check the TypeScript types |
| `pnpm build` | Produce the static web export in `static-build/` |
| `pnpm start` | Serve that export |

Whole workspace — run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm install` | Install everything under `artifacts/` and `lib/` (not `backend/`) |
| `pnpm typecheck` | Typecheck every workspace package |
| `pnpm build` | Typecheck, then build every workspace package |

---

## Troubleshooting

**`Missing required environment variables: ANTHROPIC_API_KEY`**
You haven't created `backend/.env`, or the key line is empty. Run
`cp .env.example .env` **inside `backend/`** and paste your key. Note the
backend reads `backend/.env`, not the `.env` at the repo root — a key in the
root file won't be picked up when you start the server from `backend/`.

**The first `npm run dev` hangs for a minute or two**
It's downloading the ~100 MB MongoDB binary. Let it finish — once per machine,
and it needs internet.

**`EADDRINUSE: address already in use :::5000`**
Something is already on port 5000, most likely an earlier copy of this server
that didn't shut down. Close it, or set `PORT=5001` in `backend/.env`.

**A user id that worked a minute ago returns `404`**
You restarted the backend, which wipes the in-memory database. Every restart
gives you an empty database. Create the profile again, or set a real `MONGO_URI`
— see [the database section](backend/README.md#the-database-read-this-one).

**The app shows the generic first-aid steps instead of Claude's**
That's the fallback doing its job. Check, in order: is the backend running? Did
you add a photo (the backend rejects a profile without one)? Does Terminal 1
show the request arriving? Is `ANTHROPIC_API_KEY` valid?

**The app on my phone can't reach the backend**
`localhost` on a phone means the phone itself. Make sure both devices are on the
same Wi-Fi, and set `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:5000` in
`artifacts/medical-alert/.env`, then restart Expo.

**A deployed HTTPS frontend can't reach an HTTP backend**
Browsers block plain `http://` calls from an `https://` page. The deployed
backend must be served over HTTPS too.

**`pnpm dev` fails in `artifacts/medical-alert`**
That script is written for Replit's environment. Use `pnpm exec expo start`
locally instead.

**`Use pnpm instead`**
You ran `npm install` at the repo root. The root is a pnpm workspace — use
`pnpm install` there. `npm install` is only for `backend/`.

More backend-specific errors are covered in
[`backend/README.md`](backend/README.md#troubleshooting).

---

## Deploying

[`backend/DEPLOYMENT.md`](backend/DEPLOYMENT.md) walks through it end to end:
a free MongoDB Atlas cluster, the backend on Render, and rebuilding the frontend
so the new API URL is baked into the bundle.

Two things that catch people out:

- **`NODE_ENV=production` makes `MONGO_URI` mandatory.** This is deliberate —
  the in-memory demo database would silently lose every profile on restart, so
  the server refuses to start rather than pretend to work.
- **Setting `EXPO_PUBLIC_API_URL` is not enough.** The frontend must be rebuilt,
  because the value is compiled into the bundle. There's a runtime escape hatch
  (`window.__MEDICAL_ALERT_API_URL__`) if you need to repoint a build you can't
  rebuild — see `artifacts/medical-alert/.env.example`.

---

## Known limitations

Being honest about these matters more than hiding them.

- **There is no authentication.** Anyone who knows a user id can read that
  profile and trigger its alert screen. That's a deliberate trade-off for the
  use case — a bystander holding a stranger's phone has no login — but it means
  ids should be treated as secrets, and production would need rate limiting on
  `/api/emergency/trigger` plus HTTPS.
- **Photos are stored on the server's local disk.** Running more than one
  instance would need shared storage such as S3, and free-tier hosts wipe that
  disk on every deploy, so stored photo URLs will start returning 404.
- **The local demo database is in memory**, so nothing survives a restart.
  Setting `MONGO_URI` is the one-line fix.
- **Steps are generated in the language chosen at setup.** If the user later
  switches the UI language, the app falls back to the built-in translated
  guidance rather than showing Claude's steps in the wrong language.
- **Claude's output is first-aid guidance, not medical advice.** Step 1 is
  always "call emergency services" by design.

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Express** | The backend web framework. It matches incoming URLs to your functions |
| **Middleware** | A function that runs before the main handler; can pass the request on or reject it |
| **Route** | A URL + HTTP method pair (`POST /api/users/setup`) mapped to handlers |
| **Controller** | The function holding the logic for one endpoint |
| **Service** | A module wrapping one external system, with no knowledge of HTTP |
| **Model / schema** | A Mongoose description of what a database document looks like |
| **Mongoose** | The library that talks to MongoDB and enforces those schemas |
| **ObjectId** | MongoDB's 24-character hexadecimal id, e.g. `6aa1fd9f72fe21111b91d868` |
| **multipart/form-data** | The request encoding used to send a file and text fields together |
| **multer** | The library that parses `multipart/form-data` and saves the file |
| **CORS** | The browser rule deciding which websites may call this API |
| **i18n** | "Internationalisation" — here, the English/Arabic message catalogue |
| **RTL** | Right-to-left, the text direction Arabic uses |
| **Prompt injection** | Text smuggled into AI input that tries to override its instructions |
| **Webhook** | A URL this server POSTs to in order to notify another system |
| **Expo** | The toolchain that runs React Native without Xcode or Android Studio |
| **Metro** | Expo's JavaScript bundler, the thing `expo start` launches |
| **AsyncStorage** | React Native's key-value store on the device — like `localStorage` |
| **Local-first** | Saving to the device first and syncing to a server after, so the app works offline |
| **pnpm workspace** | Several packages in one repo sharing a single `node_modules` |
| **`tel:` link** | A URL like `tel:+201001234567` that opens the phone's dialler |
