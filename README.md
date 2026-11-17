# BookLeaf Author Support Portal

A support and communication portal for **BookLeaf Publishing**, a self-publishing company in India and the US. Authors see their books and royalties and raise support tickets; the operations team works a prioritised ticket queue with AI-assisted triage and reply drafting.

**Live demo:** https://bookleaf-author-portal-fawn.vercel.app — sign in with one of the [demo accounts](#demo-accounts) (one-click buttons on the login page).

**Stack:** Next.js 15 (App Router) · React 19 · PostgreSQL on Neon · Prisma · Tailwind CSS 4 · Anthropic Claude API · JWT auth (`jose`) · Zod

---

## What it does

### Author portal (`/author`)
- **My Books** — every book with ISBN, MRP, copies sold, royalty earned / paid / pending, last payout and where it is sold. Books still in production show their current stage.
- **Royalty summary** — totals across all books plus the *next payout date*, computed from BookLeaf's policy (quarterly, paid within 45 days of quarter end, ₹1,000 minimum before roll-over).
- **Support tickets** — raise a ticket against a specific book or the account in general, follow the conversation, and reply. Replying to a resolved ticket re-opens it.

### Admin portal (`/admin`)
- **Ticket queue** sorted by urgency (priority, then age), with search (subject, author, `#number`) and filters for status, category, priority, assignee and date range.
- **Response-time targets** per priority (Critical 4h · High 24h · Medium 48h · Low 72h) so breaching tickets stand out.
- **Ticket workspace** — the author's full book/royalty context next to the thread, status and assignment controls, public replies and **internal notes** that authors never see.
- **AI-drafted replies** grounded in BookLeaf policy and the author's real account data; the admin always reviews and edits before sending.
- **AI labels are transparent** — category/priority show whether they were set by the AI, keyword rules or an admin, with the AI's one-line reasoning.

---

## How the AI is used

| Task | When | What the model sees |
|---|---|---|
| **Triage** (category + priority) | Right after a ticket is created, in the background (`after()`), so the author never waits | Subject + description only, clipped |
| **Reply draft** | First time an admin opens a ticket; cached on the ticket | Relevant knowledge-base section, one example reply, the author's book/royalty facts, last few public messages |

**Designed to never block the product:**
- A deterministic **keyword classifier** labels every ticket instantly. AI results replace those labels when they arrive, and if the AI is slow, down or unconfigured, the rule-based labels simply stay.
- A **circuit breaker** stops calling the API for 60 s after 3 consecutive failures, so an outage doesn't add timeout latency to every request.
- Short timeouts and limited retries fail fast into the fallback.
- **Admin decisions win** — once an admin changes a label, later AI runs never overwrite it.
- **Policy guardrails** in code (e.g. ISBN errors are always at least High priority) are applied on top of both AI and rules.
- Without an API key the app is fully usable: rule-based labels and a structured reply template replace the AI.

**Cost management:**
- Triage sends only the ticket text — no knowledge base, account data or history — and uses structured JSON output, so there are no retries for malformed responses.
- Drafts include only the knowledge-base sections for the ticket's category and one calibration example, not the whole knowledge base.
- Royalty and date arithmetic is **pre-computed in code** and given to the model as facts; the model never does maths.
- Stable instructions come first with prompt caching, so repeated calls reuse the cached prefix.
- Drafts are cached per ticket and only regenerated when the conversation or category changes.
- Every model call is logged to `AiLog` with input/output tokens, latency and success, for cost and latency monitoring.

**Prompt-injection hygiene:** ticket text is treated as untrusted input; prompts instruct the model to classify/answer it, never to follow instructions inside it.

---

## Security

- **Two layers of access control.** Edge middleware guards pages and APIs by role; every API handler re-checks the session and role (`apiHandler`), and the service layer enforces ownership (authors only ever see their own tickets and books). A misconfigured middleware matcher can't expose data on its own.
- **Sessions** are signed JWTs (HS256, 12-hour expiry) in an HTTP-only cookie; the secret must be at least 32 characters.
- **Passwords** are hashed with bcrypt. Login runs the hash comparison even for unknown emails, so response timing doesn't reveal which accounts exist.
- **All input is validated** with Zod; malformed JSON returns 400, not 500.
- **Role-specific serializers** — authors never receive internal notes, AI internals or assignment data.
- The Anthropic API key is read on the server only.

---

## Architecture

```
src/
├── middleware.js            Edge auth guard (pages + API)
├── app/
│   ├── login/               Sign-in page
│   ├── author/              Author portal (books, tickets)
│   ├── admin/               Admin queue + ticket workspace
│   └── api/                 Thin route handlers → services
│       ├── auth/            login · logout · me
│       ├── books/
│       ├── tickets/         list · create · get · update
│       │   └── [id]/        messages · draft · triage
│       └── health/          DB + AI status (public)
├── lib/
│   ├── services/            Business logic and ownership rules
│   ├── ai/                  Claude client, classifier, drafter, rules, knowledge base
│   ├── auth/                JWT + session helpers
│   ├── api/                 Handler wrapper + typed errors
│   ├── royalty.js           Payout schedule logic
│   └── validation.js        Zod schemas
└── components/              Shared UI (AppShell, badges, forms)
prisma/
├── schema.prisma            User · Author · Book · Ticket · TicketMessage · AiLog
├── migrations/
└── seed.js                  Loads prisma/data/bookleaf_sample_data.json
```

**Design notes**
- Route handlers only validate input and call a service; all business rules live in `lib/services`.
- **Live updates use polling** (every 5–10 s, paused while the tab is hidden) rather than WebSockets: it works reliably on serverless hosting and support tickets don't need sub-second latency.
- **Database:** Neon Postgres via Prisma — the app uses the pooled connection; migrations use the direct connection.

---

## Running locally

**Requirements:** Node.js 20+ and a PostgreSQL database (a free [Neon](https://neon.com) project works).

```bash
npm install
cp .env.example .env        # then fill in the values below
npx prisma migrate deploy   # create tables
npm run db:seed             # load sample authors, books and tickets
npm run dev                 # http://localhost:3000
```

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection (app traffic) |
| `DATABASE_URL_UNPOOLED` | Yes | Direct Postgres connection (Prisma Migrate) |
| `JWT_SECRET` | Yes | Session signing secret, 32+ characters |
| `ANTHROPIC_API_KEY` | No | Enables AI triage and drafts; without it the rule-based fallback is used |
| `AI_MODEL` | No | Claude model ID (default `claude-haiku-5-5`) |
| `REFERENCE_DATE` | No | Fixed "today" for royalty dates, since the sample data is a snapshot. Leave empty in production |

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Author | `priya.sharma@email.com` | `author123` |
| Author (books in production) | `sneha.kulkarni@email.com` | `author123` |
| Admin | `admin@bookleaf.com` | `admin123` |

The login page also has one-click buttons for these accounts.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Generate Prisma client, apply migrations, production build |
| `npm run db:migrate` | Create a new migration during development |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |
| `GET /api/health` | Reports database and AI status |

---

## Trade-offs and next steps

- **Attachments** are recorded by file name only; real uploads would go to object storage.
- The **circuit breaker** is in memory per server instance; with several instances it should move to a shared store such as Redis.
- **Polling** would move to server-sent events or a realtime service if the queue grew large.
- **Automated tests** for the service layer, royalty logic and rule classifier would be the next addition.
- **Email notifications** to authors when the team replies.
