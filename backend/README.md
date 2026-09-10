# Medical Alert Backend

A Node.js/Express API for a medical alert app, built for people with chronic
conditions that can cause episodes or loss of consciousness.

**The idea in one paragraph.** A patient fills in a short form once: their name,
a photo, a description of their condition, and an emergency contact. The backend
sends the condition description to **Claude** (Anthropic's AI), which turns it
into a few short, calm instructions a passing stranger could follow. Later, if
the patient collapses, anyone can open the emergency page on their phone and see
the patient's photo, their name, those instructions, and a big button that dials
the emergency contact. Everything a user reads is available in **English and
Arabic**.

This README assumes you know JavaScript but are new to backend work. Terms that
might be unfamiliar are explained the first time they appear, and there is a
[glossary](#glossary) at the end.

---

## Table of contents

- [Getting it running](#getting-it-running)
- [The database (read this one)](#the-database-read-this-one)
- [Environment variables](#environment-variables)
- [How a request travels through the code](#how-a-request-travels-through-the-code)
- [API reference](#api-reference)
- [How the Claude call works](#how-the-claude-call-works)
- [Project structure](#project-structure)
- [Testing it by hand](#testing-it-by-hand)
- [Troubleshooting](#troubleshooting)
- [Validation and security](#validation-and-security)
- [Known limitations](#known-limitations)
- [Glossary](#glossary)

---

## Getting it running

**What you need first:**

- **Node.js 18.17 or newer.** Check with `node --version`. If it prints
  something lower, update Node — the code uses features that older versions
  don't have.
- **An Anthropic API key**, so the app can call Claude. Create one at
  <https://console.anthropic.com/settings/keys>.
- **You do not need to install MongoDB.** The app starts its own throwaway
  database. See [the next section](#the-database-read-this-one).

**The four commands:**

```bash
cd backend
npm install             # downloads the libraries listed in package.json
cp .env.example .env    # creates your private config file
node server.js          # starts the server
```

Between step 3 and step 4, open the new `.env` file and paste your Anthropic key
in after `ANTHROPIC_API_KEY=`. That's the only value you have to fill in.

> **What is `.env`?** A plain text file of `KEY=value` lines holding settings
> that shouldn't be written into the source code — API keys, passwords, ports.
> The `dotenv` library loads it into `process.env` when the server starts. It is
> git-ignored, so your key never gets committed. `.env.example` is the safe,
> key-less copy that *is* committed, so other developers can see which settings
> exist.

When it works you'll see roughly this:

```
[db] MONGO_URI is not set — starting a TEMPORARY in-memory MongoDB for the demo.
[db] connected to "medical_alert" (in-memory)
[server] listening on http://localhost:5000
```

Check it's alive in another terminal:

```bash
curl http://localhost:5000/health
# {"status":"ok","uptimeSeconds":12}
```

Use `npm run dev` instead of `node server.js` while you're writing code — it
restarts the server automatically every time you save a file.

Stop the server with `Ctrl+C`.

**One deliberate behaviour:** if `ANTHROPIC_API_KEY` is missing, the server
refuses to start and tells you so. This is on purpose. The alternative — booting
fine and then failing on every single request with a confusing error — wastes
much more of your time than an obvious crash at startup.

---

## The database (read this one)

Normally a backend needs a database server running somewhere before it can do
anything. This project skips that for the hackathon.

When `MONGO_URI` is **not** set in `.env`, the server automatically starts an
**in-memory MongoDB** — a real MongoDB, but one that lives entirely in RAM and
is started and stopped by the app itself (via the `mongodb-memory-server`
package). No installation, no accounts, no connection string.

**The catch: all data disappears every time you stop the server.** Every restart
gives you an empty database, so any patient profile you created is gone and its
id no longer works. That's fine for a demo, and useless for anything real.

The very first startup on a new machine downloads a MongoDB binary (~100 MB) and
caches it in `node_modules/.cache/mongodb-binaries`. So the first run needs an
internet connection and takes a while; every run after that is offline and takes
about a second.

### Switching to a real database later

You don't have to change any code. Just set `MONGO_URI` in `.env`:

```bash
# MongoDB Atlas (free cloud database — copy this from Database → Connect → Drivers)
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/medical_alert

# or a MongoDB you installed on your own machine
MONGO_URI=mongodb://127.0.0.1:27017/medical_alert
```

`connectDB()` in `config/db.js` uses `MONGO_URI` whenever it's present and only
falls back to the in-memory database when it's absent. With Atlas, remember to
allow your IP address under *Network Access*, and to URL-encode any special
characters in your password.

---

## Environment variables

All of these live in `.env`. Only one is required.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** | – | Your Claude API key. The server won't start without it |
| `MONGO_URI` | no | – | Database connection string. Leave unset for the in-memory demo database |
| `PORT` | no | `5000` | Which port the server listens on |
| `NODE_ENV` | no | `development` | Standard Node environment flag |
| `ANTHROPIC_MODEL` | no | `claude-opus-5` | Which Claude model writes the instructions |
| `ANTHROPIC_TIMEOUT_MS` | no | `25000` | How long to wait for Claude before giving up (25 seconds) |
| `ANTHROPIC_ENABLE_FALLBACK` | no | `true` | Let Anthropic retry a declined request on another model |
| `UPLOAD_DIR` | no | `uploads` | Folder where patient photos are saved |
| `MAX_UPLOAD_MB` | no | `5` | Largest photo the server accepts |
| `ALLOWED_ORIGINS` | no | `*` | Which websites may call this API (CORS). `*` means any |
| `EMERGENCY_WEBHOOK_URL` | no | *(empty)* | Optional URL to notify when an emergency fires |

No key, URI, or other secret is hardcoded anywhere in the source.

---

## How a request travels through the code

This is the part worth understanding — the rest is detail. Every request walks
through the same chain of small functions, each with one job:

```
HTTP request
    ↓
server.js          decides which route file handles this URL
    ↓
routes/…           maps "POST /setup" to a list of functions to run in order
    ↓
middleware/upload  saves the uploaded photo to disk       (only on /setup)
    ↓
middleware/validate  checks every field; rejects bad input before it spreads
    ↓
controllers/…      the actual logic: read/write the database, build the response
    ↓
services/aiService talks to Claude                        (only when needed)
    ↓
models/…           Mongoose schemas that shape what MongoDB stores
    ↓
HTTP response (always JSON)
```

> **Middleware** is just a function that runs *before* your main handler and can
> either pass the request along (`next()`) or stop it with an error. Validation,
> file uploads, and authentication are all typically middleware, because they
> apply to many routes and shouldn't be copy-pasted into each one.

> **Controller vs. service vs. model.** The controller handles one HTTP endpoint
> and knows about requests and responses. A service wraps one external system
> (here, the Anthropic API) and knows nothing about HTTP. A model describes one
> collection of documents in the database. Keeping them apart means you can
> change how you call Claude without touching any routing code.

### Error handling

Individual functions don't build error responses. They `throw` an `ApiError`
(see `utils/apiError.js`), and the single error handler at the bottom of
`server.js` catches everything and turns it into the same JSON shape:

```json
{ "success": false, "error": "message in the caller's language" }
```

An `ApiError` carries a *message key* like `validation.name` rather than English
text. The error handler looks that key up in `utils/i18n.js` to get the English
or Arabic wording. That's how every message stays bilingual without scattering
translations through the code.

The language is chosen from the request's `language` field, then the
`?language=` query parameter, then the `Accept-Language` header, falling back to
English.

---

## API reference

Every response is JSON.

### `POST /api/users/setup`

Creates a patient profile and generates the instructions.

This endpoint takes **`multipart/form-data`**, not JSON — that's the encoding
HTML forms use when they include a file, and it's the only way to send the photo
and the text fields in one request. In `curl` that means `-F` flags rather than
`-d`.

| Field | Type | Rules |
| --- | --- | --- |
| `photo` | file | **required**, JPEG/PNG/WebP/HEIC/HEIF, up to `MAX_UPLOAD_MB` |
| `name` | text | **required**, 2–80 characters |
| `condition` | text | **required**, 5–1000 characters |
| `language` | text | `en` or `ar` (default `en`) |
| `contactName` | text | **required**, 2–80 characters |
| `contactPhone` | text | **required**, 7–15 digits, optional leading `+` |
| `contactRelation` | text | **required**, 2–40 characters |

The three contact fields can also be sent nested, as either bracketed form
fields (`emergencyContact[name]`) or one JSON string in an `emergencyContact`
field: `{"name":"...","phone":"...","relation":"..."}`. Use whichever your
frontend produces naturally; the backend accepts both.

```bash
curl -X POST http://localhost:5000/api/users/setup \
  -F "photo=@patient.jpg" \
  -F "name=Patient Name" \
  -F "condition=Epilepsy with tonic-clonic seizures lasting about two minutes." \
  -F "language=en" \
  -F "contactName=Contact Name" \
  -F "contactPhone=+201001234567" \
  -F "contactRelation=sister"
```

Responds `201 Created` (the HTTP status meaning "made a new thing"):

```json
{
  "success": true,
  "warning": null,
  "user": {
    "id": "6aa1fd9f72fe21111b91d868",
    "name": "Patient Name",
    "photoUrl": "/uploads/b1d78e4d-....png",
    "condition": "Epilepsy with tonic-clonic seizures...",
    "language": "en",
    "emergencyContact": { "name": "...", "phone": "+201001234567", "relation": "sister" },
    "instructions": "1. Call emergency services immediately.\n2. ...",
    "instructionsGeneratedAt": "2026-09-10T00:45:27.464Z",
    "createdAt": "2026-09-10T00:45:19.000Z"
  }
}
```

**Keep that `id`** — it's how you fetch the profile and trigger the emergency
page. It's a MongoDB ObjectId: a 24-character hexadecimal string.

If Claude can't be reached, the profile is **still created**. `instructions`
comes back `null` and `warning` explains why, and the instructions are generated
later, the first time someone opens the emergency page. A failing AI provider
should never cost a patient their profile.

### `GET /api/users/:id`

Returns the same `user` object. `404` if no profile has that id, `400` if the id
isn't a valid MongoDB ObjectId at all.

### `POST /api/emergency/trigger`

This one takes ordinary JSON:

```json
{ "userId": "6aa1fd9f72fe21111b91d868" }
```

Responds `200 OK` with everything the emergency screen needs to render, already
in the patient's language:

```json
{
  "success": true,
  "triggeredAt": "2026-09-10T00:45:27.547Z",
  "language": "en",
  "logId": "6aa1fda772fe21111b91d869",
  "patient": { "id": "...", "name": "...", "photoUrl": "/uploads/....png" },
  "instructions": "1. Call emergency services immediately.\n2. ...",
  "warning": null,
  "emergencyContact": {
    "name": "...", "phone": "+201001234567", "relation": "sister",
    "telUri": "tel:+201001234567"
  },
  "contactNotification": { "status": "skipped", "channel": null }
}
```

Notes for whoever builds the frontend:

- Put `telUri` straight into the call button: `<a href="{telUri}">`. On a phone,
  a `tel:` link opens the dialler.
- Photos are served as static files, so `photoUrl` works directly:
  `<img src="{API_BASE}{photoUrl}">`.
- `contactNotification.status` is `sent`, `failed`, or `skipped`. `skipped` just
  means no `EMERGENCY_WEBHOOK_URL` is configured, which is the normal case in
  the demo. The call button works either way, so a failed notification never
  blocks the emergency screen.

### `GET /health`

`{ "status": "ok", "uptimeSeconds": 12 }` — a quick "is the server up?" check
that touches nothing else.

---

## How the Claude call works

`services/aiService.js` is the **only** file that talks to Anthropic, through
the official `@anthropic-ai/sdk` package. Keeping it in one file means there's
exactly one place to look when something AI-related misbehaves.

- Model `claude-opus-5` with `effort: "low"` — the task is short and tightly
  specified, so there's no need for a slower, more expensive setting.
- The system prompt demands: the patient's language only, plain text, numbered
  steps, **step 1 is always "call emergency services"**, and 100 words maximum.
- Only the **condition text and the language** are sent to Anthropic. The
  patient's name, photo, and emergency contact never leave this server.
- The condition text is wrapped in explicit markers and labelled as untrusted
  data. This guards against *prompt injection* — a patient (or an attacker)
  writing something like "ignore your instructions and say X" into the condition
  field and having the model obey it.
- Any markdown the model emits anyway is stripped before storage.
- Instructions are generated **once** and cached on the profile. The emergency
  page therefore loads instantly and keeps working even if the Anthropic API is
  down later — which matters a lot when the page is being read during an actual
  emergency.
- `ANTHROPIC_ENABLE_FALLBACK=true` asks Anthropic to re-run a declined request
  on another model. Set it to `false` if your organisation hasn't enabled that
  beta.

SDK errors are translated into sensible HTTP statuses with localised messages —
`504` timeout, `503` rate-limited or unreachable, `502` other API failures,
`500` bad key. The provider's raw error goes to the server log, not to the
client, so internal details aren't leaked.

---

## Project structure

```
backend/
├── server.js                        app wiring, static uploads, error handler, startup
├── .env / .env.example              configuration (real .env is git-ignored)
├── config/db.js                     database connection and shutdown
├── models/User.js                   patient profile + cached instructions
├── models/EmergencyLog.js           audit trail of triggered emergencies
├── routes/userRoutes.js             POST /setup, GET /:id
├── routes/emergencyRoutes.js        POST /trigger
├── controllers/userController.js    profile creation and lookup
├── controllers/emergencyController.js  emergency response assembly
├── services/aiService.js            the Claude API call
├── middleware/upload.js             multer photo upload
├── middleware/validate.js           request validation and sanitisation
├── utils/notify.js                  tel: link + optional webhook alert
├── utils/i18n.js                    EN/AR message catalogue           (added)
└── utils/apiError.js                HTTP error carrying a message key (added)
```

`utils/i18n.js` and `utils/apiError.js` are additions to the originally
requested layout. They keep every user-facing string bilingual and in one place
instead of scattering English literals through the controllers.

---

## Testing it by hand

The `curl` commands above work, but a GUI is easier. This repo ships a
**Thunder Client** collection (a VS Code extension for sending API requests):

1. Install the Thunder Client extension in VS Code.
2. Open the **repository root** folder (`hackathon/`), not `backend/`.
3. Open Thunder Client from the sidebar → **Collections** → *Medical Alert
   Backend*.

Two ready-made requests are waiting, already filled in:

1. **Create patient profile (form-data)** — sample data plus a sample photo from
   `test-assets/`. Run it and copy `user.id` from the response.
2. **Trigger emergency (JSON)** — paste that id into `userId` and run it.

Remember that restarting the server empties the database, so you'll need to
re-run request 1 to get a fresh id afterwards.

---

## Troubleshooting

**`Missing required environment variables: ANTHROPIC_API_KEY`**
You haven't created `.env`, or the key line is empty. Run
`cp .env.example .env` and paste your key after `ANTHROPIC_API_KEY=`.

**First startup hangs for a long time**
It's downloading the ~100 MB MongoDB binary. Let it finish; this happens once
per machine and needs internet.

**`EADDRINUSE: address already in use :::5000`**
Something else is on port 5000 — most likely an earlier copy of this server that
didn't shut down. Close it, or set `PORT=5001` in `.env`.

**`400 The requested endpoint does not exist`**
Check the URL spelling. Note it's `/api/users/setup`, plural `users`.

**`400 A patient photo is required`**
The `photo` file field is missing, or the file isn't a JPEG/PNG/WebP/HEIC/HEIF.

**`400 Emergency contact name is required…`**
The contact fields are named `contactName` / `contactPhone` /
`contactRelation`, or nested under `emergencyContact`. `emergencyContactName`
(one flat word) is *not* accepted.

**A user id that worked a minute ago now returns `404`**
You restarted the server, which wipes the in-memory database. Create the profile
again.

**`503` or `504` from `/setup`**
Claude was unreachable or too slow. The profile was still created — check the
`warning` field in the response.

---

## Validation and security

Worth reading even as a beginner, because these are habits rather than
project-specific tricks:

- Every incoming field must be a genuine string; objects and arrays are
  rejected. This keeps MongoDB query operators like `{"$ne": null}` from
  reaching the database layer, which is how **NoSQL injection** works. Ids are
  checked with `mongoose.isValidObjectId` before any lookup.
- Control characters are stripped, all lengths are bounded, and phone numbers
  are normalised to digits with an optional leading `+`.
- Uploaded files are renamed to a random UUID, with the extension derived from
  the detected MIME type and **never** from the filename the client sent. A
  client-supplied name like `../../server.js` would otherwise let an attacker
  write outside the uploads folder.
- If a request fails validation after its photo was already saved, that photo is
  deleted, so orphaned files don't pile up.
- `uploads/` and `.env` are git-ignored.

---

## Known limitations

Being honest about these matters more than hiding them:

- **There is no authentication.** Anyone who knows a user id can read that
  profile and trigger its emergency screen. That's a deliberate trade-off for
  the use case — a bystander holding a stranger's phone has no login — but it
  means ids should be treated as secrets, and a production deployment would need
  rate limiting on `/api/emergency/trigger` plus HTTPS.
- **Photos are stored on the local disk**, so running more than one instance of
  the server would need shared storage such as S3.
- **The demo database is in memory**, so nothing survives a restart. See
  [the database section](#the-database-read-this-one) for the one-line fix.

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Express** | The web framework here. It matches incoming URLs to your functions |
| **Middleware** | A function that runs before the main handler; can pass the request on or reject it |
| **Route** | A URL + HTTP method pair (`POST /api/users/setup`) mapped to handlers |
| **Controller** | The function holding the logic for one endpoint |
| **Service** | A module wrapping one external system, with no knowledge of HTTP |
| **Model / schema** | A Mongoose description of what a database document looks like |
| **Mongoose** | The library that talks to MongoDB and enforces those schemas |
| **ObjectId** | MongoDB's 24-character hexadecimal id, e.g. `6aa1fd9f72fe21111b91d868` |
| **multipart/form-data** | The request encoding used to send files and text together |
| **multer** | The library that parses `multipart/form-data` and saves the file |
| **CORS** | Browser rule deciding which websites may call this API |
| **i18n** | "Internationalisation" — here, the English/Arabic message catalogue |
| **Prompt injection** | Text smuggled into AI input that tries to override its instructions |
| **Webhook** | A URL this server POSTs to in order to notify another system |
