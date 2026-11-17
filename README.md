# BookLeaf Author Support Portal

A support and communication portal for **BookLeaf Publishing**. Authors see their books and royalties and raise support tickets; the operations team works a prioritised ticket queue with AI-assisted triage and reply drafting.

**Live demo:** https://bookleaf-author-portal-fawn.vercel.app — sign in with one of the [test accounts](#test-accounts) (one-click buttons on the login page).

> **AI provider:** the AI layer supports **Google Gemini** and **Anthropic Claude** behind one interface; whichever key is set is used. The live demo runs on **Gemini Flash-Lite (free tier)** because the Claude API is paid. Adding an `ANTHROPIC_API_KEY` switches it to Claude Haiku 5.5 with no code changes, and with no key at all the app falls back to keyword labels and reply templates (see [AI integration](#ai-integration)).

**Stack:** Next.js 15 (App Router) · React 19 · PostgreSQL on Neon · Prisma · Tailwind CSS 4 · Google Gemini / Anthropic Claude · JWT auth (`jose`) · Zod

**Contents:** [Features](#features) · [Test accounts](#test-accounts) · [Running locally](#running-locally) · [Architecture](#architecture) · [AI integration](#ai-integration) · [Security](#security) · [API reference](#api-reference) · [Known limitations](#known-limitations-and-next-steps) · [Write-up](WRITEUP.md)

---

## Features

### Author portal (`/author`)
- **My Books** — every book with title, ISBN, genre, publication date, status, MRP, copies sold, royalty earned / paid / pending, last payout and where it is sold. Books still in production show their current stage instead of sales figures; books with no payout yet say so instead of showing a blank.
- **Royalty summary** — totals across all books plus the *next payout date*, computed from BookLeaf's policy (quarterly, paid within 45 days of quarter end, ₹1,000 minimum before roll-over).
- **Raise a ticket** — pick a book or "General / Account level", subject, description and an optional attachment (file name recorded; see limitations).
- **My Tickets** — status, the original query and every team reply, updating without a page refresh. Authors can reply; replying to a resolved ticket re-opens it.

### Admin portal (`/admin`)
- **Ticket queue** sorted by urgency (priority, then oldest first), with search (subject, author or `#number`) and filters for status, category, priority, assignee and date range. Counters show open, in-progress, critical, unassigned and "mine".
- **Response-time targets** per priority (Critical 4h · High 24h · Medium 48h · Low 72h) so breaching tickets stand out.
- **Ticket workspace** — the author's book and royalty context next to the thread, status and assignment ("assign to me"), category/priority override, public replies and **internal notes** that authors never see, and "send & resolve" in one step.
- **AI-drafted replies** grounded in BookLeaf policy and the author's real account data, loaded into an editable reply box. The admin always reviews before sending.
- **Transparent labels** — category and priority show whether they were set by the AI, keyword rules or an admin, with the AI's one-line reasoning. Admins can re-run AI triage on any ticket.

---

## Test accounts

All sample data from `bookleaf_sample_data.json` (10 authors, 18 books) is seeded, plus 6 demo tickets.

| Role | Email | Password | Good for testing |
|---|---|---|---|
| Admin | `admin@bookleaf.com` | `admin123` | Ticket queue, AI drafts, overrides |
| Admin | `support@bookleaf.com` | `admin123` | Assignment between two admins |
| Author | `priya.sharma@email.com` | `author123` | Pending royalty on a published book |
| Author | `sneha.kulkarni@email.com` | `author123` | A book in production (Cover Design) |
| Author | `kavita.deshmukh@email.com` | `author123` | A book in production (Typesetting) |

Every author in the dataset can log in with their email from the JSON file and the password `author123`.

---

## Running locally

**Requirements:** Node.js 20+ and a PostgreSQL database (a free [Neon](https://neon.com) project works).

```bash
npm install
cp .env.example .env        # then fill in the values below
npx prisma migrate deploy   # create tables
npm run db:seed             # load the sample authors, books and demo tickets
npm run dev                 # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection (app traffic) |
| `DATABASE_URL_UNPOOLED` | Yes | Direct Postgres connection (Prisma Migrate) |
| `JWT_SECRET` | Yes | Session signing secret, 32+ characters |
| `GEMINI_API_KEY` | No* | Enables AI with Google Gemini. Free tier: create a key at [aistudio.google.com](https://aistudio.google.com) |
| `GEMINI_MODEL` | No | Gemini model ID (default `gemini-flash-lite-latest`) |
| `ANTHROPIC_API_KEY` | No* | Enables AI with Anthropic Claude. Paid: create a key at [console.anthropic.com](https://console.anthropic.com) |
| `ANTHROPIC_MODEL` | No | Claude model ID (default `claude-haiku-5-5`; the older name `AI_MODEL` also works) |
| `AI_PROVIDER` | No | Force `gemini` or `anthropic` when both keys are set (default: Anthropic first) |

\* Set one AI key to enable AI triage and drafts. Without any, the app uses the rule-based fallback.
| `REFERENCE_DATE` | No | Fixed "today" for royalty dates, because the sample data is a snapshot (latest payout 2025-12-01). Leave empty in production |

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Generate Prisma client, apply migrations, production build |
| `npm run db:migrate` | Create a new migration during development |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |

---

## Architecture

```
src/
├── middleware.js            Edge auth guard (pages + API)
├── app/
│   ├── login/               Sign-in page
│   ├── author/              Author portal (books, tickets)
│   ├── admin/               Admin queue + ticket workspace
│   └── api/                 Thin REST route handlers → services
├── lib/
│   ├── services/            Business logic and ownership rules (tickets, books, auth)
│   ├── ai/                  AI client (breaker, logging), classifier, drafter, keyword rules, knowledge base
│   │   └── providers/       Gemini and Anthropic adapters
│   ├── auth/                JWT + session helpers
│   ├── api/                 Handler wrapper (auth, RBAC, errors) + typed errors
│   ├── royalty.js           Payout schedule logic
│   └── validation.js        Zod schemas for every request
└── components/              Shared UI (AppShell, badges, forms)
prisma/
├── schema.prisma            User · Author · Book · Ticket · TicketMessage · AiLog
├── migrations/
└── seed.js                  Loads prisma/data/bookleaf_sample_data.json
```

### Decisions and why

- **Next.js full-stack (one deployable).** The UI and the REST API live in one project and deploy together to Vercel, which keeps the 4-day scope realistic while still giving a clean API boundary: the frontend only talks to `/api/*` through `fetch`, never to the database.
- **Layered backend.** Route handlers only parse input (Zod) and call a service; services hold every business and ownership rule; the AI layer is separate again. Swapping the UI, the AI provider or the database touches one layer.
- **PostgreSQL + Prisma.** Tickets, messages, users and books are relational and the queue needs filtered, sorted, indexed queries (`status, priority, createdAt`). Prisma gives typed queries and versioned migrations. Neon provides the pooled connection for serverless traffic and a direct one for migrations.
- **Authors and users are separate tables.** `Author` holds the business record from the dataset; `User` holds login and role. Admins are users without an author record, so ownership checks are a single `authorId` comparison.
- **Provider-neutral AI layer.** The classifier and drafter describe what they need (system blocks, user text, token limit, effort, optional JSON schema); a small adapter per provider translates that into a Gemini or Anthropic call. The circuit breaker, refusal handling and usage logging live once in `client.js`, so adding another provider is one new file.
- **Labels remember who set them.** `categorySource` / `prioritySource` (`AI`, `RULES`, `ADMIN`) let the UI show provenance and stop a late AI result from overwriting an admin's decision.
- **Polling for live updates** (every 5–10 s, paused while the tab is hidden). Vercel functions can't hold WebSocket connections, and support tickets don't need sub-second latency; polling is the most reliable option on this hosting.
- **Stateless JWT sessions** in an HTTP-only cookie, verified the same way in Edge middleware and in route handlers.

---

## AI integration

### Where the AI is used

| Task | When it runs | What the model sees |
|---|---|---|
| **Triage** — category + priority + one-line reason | Right after a ticket is created, in the background via Next.js `after()`, so the author never waits | Subject + description only (clipped) |
| **Reply draft** | First time an admin opens a ticket; cached on the ticket | The knowledge-base sections for that category, one calibration example, the author's book/royalty facts, the last few public messages |

### Model choice: small, fast models — Gemini Flash-Lite or Claude Haiku 5.5

Both tasks are high-volume and well-specified (pick one of six labels; write a 150–200-word reply from supplied facts), so a small, fast model is the right fit; a frontier model would add cost and latency without a visible quality gain.

- **Gemini Flash-Lite** (`gemini-flash-lite-latest`, the live demo): has a **free tier**, so the demo can show real AI without a paid key. Triage takes about 1 s and a draft about 2 s; in testing it labelled the brief's sample queries correctly and drafts quoted the author's real royalty figures and payout date.
- **Claude Haiku 5.5** (`claude-haiku-5-5`, recommended for production): about $0.10 / $0.50 per million input / output tokens, so triage plus one draft costs a fraction of a cent per ticket — sensible for 1,200+ books a month. Paid API, data not used for training, and explicit prompt caching.
- **Both support structured outputs:** triage uses a JSON schema, so the category and priority are always valid enum values and never need a retry.
- **Swappable:** provider and model are environment variables, so drafts could move to a larger model (e.g. Claude Sonnet) by changing one value.

### Prompt strategy

- **Classifier** (`src/lib/ai/classifier.js`): a system prompt with a definition for each of the six categories and a priority rubric based on business impact, not the author's tone (e.g. "no royalty for 6+ months" → Critical, "update my bio" → Low). Low effort, no extended reasoning, JSON-schema output.
- **Drafter** (`src/lib/ai/drafter.js`): writes as a senior BookLeaf support agent using the brief's tone guidelines (acknowledge first, be specific, own BookLeaf's mistakes, give a timeline, end with a next step). It must ground every fact in the supplied knowledge base and account data and never invent figures, dates or policies. Output is plain text, 120–220 words, signed "BookLeaf Author Support".
- **Account facts are computed in code** (`src/lib/ai/context.js`, `src/lib/royalty.js`): the next payout date, pending amounts and the ₹1,000 threshold are worked out before the call and given to the model as data, so the model never does date or currency arithmetic.
- **Prompt-injection hygiene:** ticket text is wrapped in tags and treated as untrusted input; both prompts tell the model to classify or answer it, never follow instructions inside it.

### Error handling and graceful degradation

- A deterministic **keyword classifier** (`src/lib/ai/rules.js`) labels every ticket instantly at creation. The AI result replaces those labels when it arrives; if the AI is slow, down, rate-limited or unconfigured, the rule-based labels stay. It handles all nine sample queries in the brief correctly.
- **Policy guardrails** in code apply on top of both AI and rules — e.g. ISBN errors are always at least High priority.
- **Timeouts and retries:** 15 s for triage, 45 s for drafts; rate limits (429) and server errors (5xx, including Gemini's "high demand" 503) are retried twice with backoff, then the call fails fast into the fallback.
- **Circuit breaker:** after 3 consecutive failures, AI calls are skipped for 60 s so an outage doesn't add timeout latency to every request.
- **Refusals and truncation** are detected and treated as failures, not shown to admins.
- **Drafts fall back to a structured template** with the author's name and placeholders, so admins can always write and send a reply manually. The UI says why the AI draft is unavailable.
- **Admin decisions win:** once an admin overrides a label, a late or background AI result never changes it. Only an explicit "re-run AI triage" by an admin hands the labels back to the AI (useful after an outage).

### Cost management

- **Triage sends only the ticket text** — no knowledge base, account data or history.
- **Drafts send only what the category needs:** the matching knowledge-base sections (not the whole knowledge base), one example, the referenced book in full and other books as one-liners, and only the last 4 public messages, each clipped.
- **Caching at two levels:** the stable instruction prefix comes first so the provider can cache it (explicit `cache_control` on Claude, implicit caching on Gemini), and each draft is stored on the ticket so re-opening it costs nothing. It is regenerated only when the conversation or category changes.
- **Every model call is logged** to the `AiLog` table with input/output tokens, latency and success, as the basis for cost and latency monitoring.

---

## Security

- **API key** is read from the environment on the server only; no AI module is imported by client components, and `.env` is git-ignored.
- **Two layers of access control:** Edge middleware guards every page and API route by role; every API handler re-checks the session and role (`apiHandler`), and the service layer enforces ownership (authors only ever see their own tickets and books). A misconfigured middleware matcher can't expose data on its own.
- **Sessions** are signed JWTs (HS256, 12-hour expiry) in an HTTP-only cookie; the secret must be at least 32 characters.
- **Passwords** are hashed with bcrypt. Login runs the hash comparison even for unknown emails, so response timing doesn't reveal which accounts exist.
- **All input is validated** with Zod; malformed JSON returns 400, not 500, and unexpected errors are logged server-side without leaking details.
- **Role-specific serializers:** authors never receive internal notes, AI reasoning or assignment data.

---

## API reference

All endpoints are under `/api`, accept and return JSON, and require a session unless marked public. Authenticate with the `bl_session` cookie set by login, or send `Authorization: Bearer <token>` using the token login returns.

**Success:** `{ "data": ... }` (lists add `pagination`, and for admins `summary`).
**Errors:** always `{ "error": { "code", "message", "details?" } }`.

| Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON or an invalid operation |
| 401 | `UNAUTHORIZED` | Missing, invalid or expired session |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password at login |
| 403 | `FORBIDDEN` | Role not allowed (e.g. an author calling an admin endpoint) |
| 404 | `NOT_FOUND` | Record missing, or belongs to another author |
| 409 | `CONFLICT` | Duplicate record |
| 422 | `VALIDATION_ERROR` | Field errors in `details: [{ field, message }]` |
| 503 | `DATABASE_UNAVAILABLE` | Database unreachable |

### Auth

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Body `{ email, password }`. Sets the session cookie and returns `{ user, token }` |
| `POST` | `/api/auth/logout` | Public | Clears the session cookie. `204 No Content` |
| `GET` | `/api/auth/me` | Any user | The current user: `id, role, authorId, name, email` |

### Books

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/books` | Author, Admin | Authors get their own books plus a royalty `summary` (totals and next payout). Admins get all books; filter with `?authorId=AUTH001` |

### Tickets

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/tickets` | Author, Admin | Authors: own tickets, most recently updated first. Admins: the queue, most urgent then oldest first, plus `summary` counters |
| `POST` | `/api/tickets` | Author | Raise a ticket. Returns `201` immediately with rule-based labels; AI triage runs in the background |
| `GET` | `/api/tickets/:id` | Author (own), Admin | Ticket with its full thread. Authors don't receive internal notes |
| `PATCH` | `/api/tickets/:id` | Admin | Update `status`, override `category` / `priority`, set `assigneeId` |
| `POST` | `/api/tickets/:id/messages` | Author (own), Admin | Add a reply. Admins can add an internal note or change status in the same call |
| `GET` | `/api/tickets/:id/draft` | Admin | The AI draft for the ticket, generated on first request and then cached |
| `POST` | `/api/tickets/:id/draft` | Admin | Force a new draft ("Regenerate") |
| `POST` | `/api/tickets/:id/triage` | Admin | Re-run AI classification (e.g. after an outage). This is an explicit admin action, so it hands category and priority back to the AI, replacing earlier overrides |

**`GET /api/tickets` query parameters** (all optional)

| Param | Values |
|---|---|
| `status` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `active` (Open + In Progress; the admin default) or `all` |
| `category` | `ROYALTY_PAYMENTS`, `ISBN_METADATA`, `PRINTING_QUALITY`, `DISTRIBUTION`, `PRODUCTION_STATUS`, `GENERAL` |
| `priority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `assignee` | `me`, `unassigned`, `any` |
| `from`, `to` | Created-date range, e.g. `2026-01-01` |
| `q` | Search subject, author name or ticket number |
| `page`, `pageSize` | Pagination (default 1 and 25, max 100) |

**`POST /api/tickets` body**

```json
{
  "bookId": "BK002",
  "subject": "Royalty for last quarter not received",
  "description": "My Q3 royalty hasn't arrived and my bank details haven't changed.",
  "attachmentName": "statement.pdf"
}
```

`bookId` may be `null` or `"GENERAL"` for an account-level query. `subject` 5–150 characters; `description` 20–5000 characters; `attachmentName` optional.

**`PATCH /api/tickets/:id` body** — at least one field

```json
{ "status": "IN_PROGRESS", "category": "ROYALTY_PAYMENTS", "priority": "HIGH", "assigneeId": "me" }
```

`assigneeId` is `"me"`, a user ID, or `null` to unassign. A category or priority sent here is marked as set by an admin.

**`POST /api/tickets/:id/messages` body**

```json
{ "body": "Hi Priya, ...", "isInternal": false, "usedAiDraft": true, "setStatus": "RESOLVED" }
```

`isInternal` and `setStatus` are admin-only (an author sending them gets `403`). An admin's first public reply sets an open ticket to In Progress; an author's reply re-opens a resolved ticket.

**Draft response**

```json
{ "data": { "draft": "Hi Priya, ...", "source": "AI", "cached": true, "generatedAt": "2026-11-17T13:12:18.386Z" } }
```

`source` is `"TEMPLATE"` with an `unavailableReason` when the AI can't be used.

### Health

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Database and AI status, e.g. `{ "status": "ok", "database": "ok", "ai": "ok", "aiProvider": "gemini", "aiModel": "gemini-flash-lite-latest" }`. Returns `503` if the database is down. Exposes no secrets |

---

## Known limitations and next steps

- **Free-tier AI on the live demo.** Gemini's free tier has tight rate limits and Google may use free-tier prompts to improve its products; heavy use falls back to keyword labels and templates. Production would use a paid key (Claude Haiku 5.5) — a configuration change only.
- **Attachments** are recorded by file name only; real uploads would go to object storage with virus scanning.
- **Circuit breaker** state is in memory per server instance; with several instances it should move to a shared store such as Redis.
- **Polling** would move to server-sent events or a managed realtime service as the queue grows.
- **No automated tests yet** — the next addition would be unit tests for the service layer, royalty logic and keyword classifier, plus an evaluation set for AI triage accuracy against labelled tickets.
- **Notifications:** authors should get an email when the team replies.
- **Admin tooling:** canned responses, bulk actions and SLA reporting from the `AiLog` and ticket timestamps.
