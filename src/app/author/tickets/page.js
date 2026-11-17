"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { usePolling } from "@/lib/client/usePolling";
import { STATUSES } from "@/lib/constants";
import { Button, Card, EmptyState, ErrorBanner, Spinner, StatusBadge, formatDateTime, timeAgo, inputClass } from "@/components/ui";

const FILTERS = [{ value: "all", label: "All" }, ...Object.entries(STATUSES).map(([value, label]) => ({ value, label }))];

function MyTickets() {
  const created = useSearchParams().get("created");
  const [status, setStatus] = useState("all");
  // Near-real-time: re-fetch every 5s so admin replies appear without a refresh.
  const { data, error, loading, refresh } = usePolling(`/api/tickets?status=${status}&pageSize=50`, 5000);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-500">Replies from the BookLeaf team appear here automatically.</p>
        </div>
        <Link href="/author/tickets/new">
          <Button>New ticket</Button>
        </Link>
      </div>

      {created && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Ticket submitted. Our team has been notified and will reply here.
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-sm ${status === f.value ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} />
      {loading && !data ? (
        <Spinner />
      ) : data?.data.length === 0 ? (
        <EmptyState title={status === "all" ? "You haven't raised any tickets yet" : "No tickets with this status"}>
          Questions about royalties, ISBNs, printing or your book&apos;s progress? <Link href="/author/tickets/new" className="text-brand-700 underline">Raise a ticket</Link>.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {data?.data.map((t) => (
            <TicketCard key={t.id} ticket={t} defaultOpen={t.id === created} onChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket: t, defaultOpen, onChange }) {
  const [open, setOpen] = useState(defaultOpen);
  const replies = t.messages ?? [];
  const lastTeamReply = [...replies].reverse().find((m) => m.sender.role === "ADMIN");

  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <span className="font-mono text-xs text-gray-400">#{t.number}</span>
        <span className="min-w-0 flex-1 font-medium text-gray-900">{t.subject}</span>
        {lastTeamReply && !open && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">Team replied {timeAgo(lastTeamReply.createdAt)}</span>}
        <StatusBadge status={t.status} />
        <span className="text-xs text-gray-400">{timeAgo(t.createdAt)}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-4">
          <p className="text-xs text-gray-500">
            {t.book ? `About: ${t.book.title}` : "General / Account level"} · Raised {formatDateTime(t.createdAt)}
          </p>
          <Message who="You" when={t.createdAt} body={t.description} attachment={t.attachmentName} />
          {replies.map((m) => (
            <Message key={m.id} who={m.sender.role === "ADMIN" ? `${m.sender.name} · BookLeaf` : "You"} team={m.sender.role === "ADMIN"} when={m.createdAt} body={m.body} />
          ))}
          {replies.length === 0 && <p className="text-sm text-gray-500">Waiting for the BookLeaf team to respond…</p>}
          {t.status !== "CLOSED" ? (
            <ReplyBox ticket={t} onSent={onChange} />
          ) : (
            <p className="text-xs text-gray-500">This ticket is closed. Raise a new ticket if you need more help.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function Message({ who, when, body, team, attachment }) {
  return (
    <div className={`rounded-md px-3 py-2 ${team ? "border-l-4 border-brand-500 bg-brand-50/50" : "bg-gray-50"}`}>
      <p className="mb-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{who}</span> · {formatDateTime(when)}
      </p>
      <p className="whitespace-pre-wrap text-sm text-gray-800">{body}</p>
      {attachment && <p className="mt-1 text-xs text-gray-500">📎 {attachment}</p>}
    </div>
  );
}

function ReplyBox({ ticket, onSent }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api(`/api/tickets/${ticket.id}/messages`, { method: "POST", body: { body } });
      setBody("");
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        className={`${inputClass} min-h-20`}
        placeholder={ticket.status === "RESOLVED" ? "Still need help? Replying will re-open this ticket." : "Add more details or reply to the team…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <ErrorBanner error={error} />
      <div className="flex justify-end">
        <Button variant="secondary" onClick={send} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MyTickets />
    </Suspense>
  );
}
