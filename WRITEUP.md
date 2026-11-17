# Write-up: BookLeaf Author Support Portal

## Approach and priorities

I treated this as an operations problem first and an AI problem second. The ops team needs every ticket to be labelled, prioritised and answerable even when the AI isn't available, so I built the core ticket flow and the fallback path before the AI features, then layered AI on top where it saves the most time: triage on every new ticket and a first draft for every reply.

In order, I prioritised:

1. **A correct, secure ticket lifecycle** — role-based access enforced in middleware, route handlers and the service layer, so an author can never reach another author's data even if one layer is misconfigured.
2. **AI that can't break the product** — tickets are created instantly with keyword-based labels, and AI triage runs in the background and replaces them. Timeouts, a circuit breaker and a template fallback mean an outage only costs quality, never availability.
3. **Grounded, specific replies** — the drafter gets BookLeaf's policy for the ticket's category plus the author's real figures, with payout dates and royalty maths computed in code rather than by the model, so replies quote real numbers instead of generic reassurance.
4. **Cost awareness** — triage sends only the ticket text; drafts send only the relevant knowledge-base section, one example and the last few messages; drafts are cached per ticket; and every call's token usage is logged.

## Trade-offs

- **Next.js for both UI and API.** One deployable kept the scope achievable in four days while still keeping a clean REST boundary. At larger scale I would split the API into its own service.
- **Polling instead of WebSockets.** Vercel functions can't hold long-lived connections, and support tickets don't need sub-second updates. Polling every 5–10 seconds, paused in background tabs, is reliable and simple.
- **Small, fast models behind a provider-neutral layer.** Triage and drafting are high-volume, well-specified tasks, so I chose small models with structured outputs that guarantee valid labels: Claude Haiku 5.5 for production, and Gemini Flash-Lite for the live demo because it has a free tier. Each provider is one small adapter; the provider and model are environment variables.
- **Attachments are UI-only**, as the brief allows; real uploads need storage and scanning.
- **Free-tier AI on the live demo.** Its rate limits are tight, so under heavy use some tickets fall back to keyword labels and templates — the same path the system takes during a real AI outage.
- **No automated test suite yet.** I verified the flows end to end by hand and checked the keyword classifier against every sample query in the brief; tests are the first thing I'd add.

## Evolving this into a production system

- **Measure AI quality:** build a labelled set of real tickets to track classification accuracy and draft acceptance (how often admins send a draft unchanged), and use it before changing prompts or models.
- **Close the loop:** feed admin overrides and edited drafts back into the prompt examples, and add canned responses for the most common questions.
- **Scale the platform:** move the circuit breaker and rate limiting to Redis, use server-sent events or a realtime service for updates, and queue AI work so bursts don't hit API rate limits.
- **Operational visibility:** dashboards for response times against targets, backlog by category and AI cost per ticket, built from the existing timestamps and `AiLog` table.
- **Author experience:** email notifications on replies, real attachment uploads, and a per-platform royalty breakdown in the dashboard.
