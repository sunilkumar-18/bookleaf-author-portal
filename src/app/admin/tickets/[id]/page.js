"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { usePolling } from "@/lib/client/usePolling";
import { CATEGORIES, LABEL_SOURCES, PRIORITIES, STATUSES } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/format";
import { Button, Card, CategoryBadge, ErrorBanner, PriorityBadge, Spinner, StatusBadge, formatDateTime, inputClass } from "@/components/ui";

export default function AdminTicketPage({ params }) {
  const { id } = use(params);
  const { data, error, loading, setData } = usePolling(`/api/tickets/${id}`, 5000);
  const ticket = data?.data;

  const applyUpdate = useCallback((updated) => setData({ data: updated }), [setData]);

  if (loading && !ticket) return <Spinner />;
  if (!ticket) return <ErrorBanner error={error ?? { message: "Ticket not found" }} />;

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-brand-700 hover:underline">← Ticket Queue</Link>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-gray-900">
            <span className="mr-2 font-mono text-sm text-gray-400">#{ticket.number}</span>
            {ticket.subject}
          </h1>
          <p className="text-sm text-gray-500">
            {ticket.author.name} ({ticket.author.email}) · {ticket.book ? ticket.book.title : "General / Account level"} · raised {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <PriorityBadge priority={ticket.priority} source={ticket.prioritySource} />
          <CategoryBadge category={ticket.category} source={ticket.categorySource} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Thread ticket={ticket} />
          <Composer ticket={ticket} onSent={applyUpdate} />
        </div>
        <div className="space-y-4">
          <Controls ticket={ticket} onUpdated={applyUpdate} />
          {ticket.book && <BookPanel book={ticket.book} />}
        </div>
      </div>
    </div>
  );
}

function Thread({ ticket }) {
  return (
    <Card className="space-y-3 p-4">
      <Bubble who={`${ticket.author.name} (author)`} when={ticket.createdAt} body={ticket.description} attachment={ticket.attachmentName} />
      {ticket.messages.map((m) => (
        <Bubble
          key={m.id}
          who={m.sender.role === "ADMIN" ? `${m.sender.name}${m.isInternal ? " · internal note" : ""}` : `${m.sender.name} (author)`}
          when={m.createdAt}
          body={m.body}
          variant={m.isInternal ? "internal" : m.sender.role === "ADMIN" ? "team" : "author"}
          aiAssisted={m.usedAiDraft}
        />
      ))}
    </Card>
  );
}

function Bubble({ who, when, body, variant = "author", attachment, aiAssisted }) {
  const style = {
    author: "bg-gray-50",
    team: "border-l-4 border-brand-500 bg-brand-50/50",
    internal: "border border-dashed border-amber-300 bg-amber-50",
  }[variant];
  return (
    <div className={`rounded-md px-3 py-2 ${style}`}>
      <p className="mb-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{who}</span> · {formatDateTime(when)}
        {aiAssisted && <span className="ml-2 rounded bg-violet-100 px-1 text-[10px] text-violet-700">from AI draft</span>}
      </p>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>
      {attachment && <p className="mt-1 text-xs text-gray-500">📎 {attachment} (author has a file to share)</p>}
    </div>
  );
}

/** Reply composer, pre-filled with the AI draft. Admin edits before sending. */
function Composer({ ticket, onSent }) {
  const [mode, setMode] = useState("reply"); // "reply" | "note"
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState({ loading: true });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const closed = ticket.status === "CLOSED";

  const loadDraft = useCallback(
    async (regenerate = false) => {
      setDraft({ loading: true });
      try {
        const { data } = await api(`/api/tickets/${ticket.id}/draft`, { method: regenerate ? "POST" : "GET" });
        setDraft(data);
        setBody(data.draft);
      } catch (err) {
        setDraft({ error: err });
      }
    },
    [ticket.id],
  );

  // Load the draft once when the ticket is opened (cached server-side after first generation).
  useEffect(() => {
    if (!closed) loadDraft(false);
  }, [ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(setStatus) {
    const isNote = mode === "note";
    setSending(true);
    setError(null);
    try {
      const { data } = await api(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        body: {
          body: isNote ? note : body,
          isInternal: isNote,
          usedAiDraft: !isNote && draft.source === "AI",
          ...(setStatus ? { setStatus } : {}),
        },
      });
      if (isNote) setNote("");
      else {
        setBody("");
        setDraft({ sent: true });
      }
      onSent(data);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  if (closed) return <Card className="p-4 text-sm text-gray-500">This ticket is closed. Re-open it from the status control to reply.</Card>;

  const text = mode === "note" ? note : body;

  return (
    <Card className="p-4">
      <div className="mb-3 flex gap-1 border-b border-gray-100">
        {[["reply", "Reply to author"], ["note", "Internal note"]].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${mode === v ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-gray-500"}`}>
            {l}
          </button>
        ))}
      </div>

      {mode === "reply" ? (
        <>
          <DraftStatus draft={draft} onRegenerate={() => loadDraft(true)} />
          <textarea
            className={`${inputClass} mt-2 min-h-64 font-[inherit]`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={draft.loading ? "Generating a draft…" : "Write your reply to the author…"}
            disabled={draft.loading}
          />
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-amber-700">Internal notes are only visible to the BookLeaf team.</p>
          <textarea className={`${inputClass} min-h-32`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Escalated to production — waiting on ISBN registry check." />
        </>
      )}

      <ErrorBanner error={error} />
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {mode === "reply" ? (
          <>
            <Button variant="secondary" disabled={sending || !text.trim()} onClick={() => send("RESOLVED")}>Send & mark resolved</Button>
            <Button disabled={sending || !text.trim()} onClick={() => send()}>{sending ? "Sending…" : "Send reply"}</Button>
          </>
        ) : (
          <Button disabled={sending || !text.trim()} onClick={() => send()}>{sending ? "Saving…" : "Add note"}</Button>
        )}
      </div>
    </Card>
  );
}

function DraftStatus({ draft, onRegenerate }) {
  if (draft.loading) return <p className="text-xs text-violet-700">✨ Drafting a reply from the knowledge base and this author&apos;s account…</p>;
  if (draft.sent) return <p className="text-xs text-gray-500">Reply sent. <button className="text-brand-700 underline" onClick={onRegenerate}>Draft a follow-up</button></p>;
  if (draft.error) return <p className="text-xs text-red-600">Could not load a draft ({draft.error.message}). You can write the reply manually.</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {draft.source === "AI" ? (
        <p className="text-xs text-violet-700">✨ AI draft — review and edit before sending. {draft.cached ? "(saved draft)" : ""}</p>
      ) : (
        <p className="text-xs text-amber-700">AI draft unavailable ({draft.unavailableReason}). Template loaded — fill in the brackets.</p>
      )}
      <Button variant="ghost" className="py-1 text-xs" onClick={onRegenerate}>Regenerate</Button>
    </div>
  );
}

/** Status, label overrides and assignment. */
function Controls({ ticket, onUpdated }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function patch(body) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api(`/api/tickets/${ticket.id}`, { method: "PATCH", body });
      onUpdated(data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function retriage() {
    setBusy(true);
    try {
      const { data } = await api(`/api/tickets/${ticket.id}/triage`, { method: "POST" });
      onUpdated(data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4 text-sm">
      <Control label="Status">
        <select className={inputClass} value={ticket.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>
          {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Control>

      <Control label="Category" source={ticket.categorySource}>
        <select className={inputClass} value={ticket.category} disabled={busy} onChange={(e) => patch({ category: e.target.value })}>
          {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Control>

      <Control label="Priority" source={ticket.prioritySource}>
        <select className={inputClass} value={ticket.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>
          {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Control>

      {ticket.aiReasoning && (
        <div className="rounded bg-violet-50 px-3 py-2 text-xs text-violet-900">
          <span className="font-medium">AI triage:</span> {ticket.aiReasoning}
          {ticket.aiStatus === "FAILED" && (
            <button className="ml-1 underline" onClick={retriage} disabled={busy}>Retry AI</button>
          )}
        </div>
      )}
      {ticket.aiStatus === "PENDING" && <p className="text-xs text-violet-700">AI triage in progress…</p>}

      <Control label="Assignee">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-800">{ticket.assignee?.name ?? "Unassigned"}</span>
          {ticket.assignee ? (
            <Button variant="ghost" className="py-1 text-xs" disabled={busy} onClick={() => patch({ assigneeId: null })}>Unassign</Button>
          ) : (
            <Button variant="secondary" className="py-1 text-xs" disabled={busy} onClick={() => patch({ assigneeId: "me" })}>Assign to me</Button>
          )}
        </div>
      </Control>

      <ErrorBanner error={error} />
    </Card>
  );
}

function Control({ label, source, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        {source && <span className="text-[11px] text-gray-400">set by {LABEL_SOURCES[source]}</span>}
      </div>
      {children}
    </div>
  );
}

function BookPanel({ book: b }) {
  const rows =
    b.status === "IN_PRODUCTION"
      ? [["Status", `In production · ${b.productionStage}`], ["ISBN", b.isbn]]
      : [
          ["Status", "Published & Live"],
          ["ISBN", b.isbn],
          ["Published", formatDate(b.publicationDate)],
          ["MRP", formatINR(b.mrp)],
          ["Copies sold", b.copiesSold],
          ["Royalty earned", formatINR(b.royaltyEarned)],
          ["Paid / pending", `${formatINR(b.royaltyPaid)} / ${formatINR(b.royaltyPending)}`],
          ["Last payout", b.lastPayoutDate ? formatDate(b.lastPayoutDate) : "Never"],
          ["Print partner", b.printPartner],
          ["Listed on", b.availableOn.join(", ")],
        ];
  return (
    <Card className="p-4 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Book · {b.title}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-right text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
