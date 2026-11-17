"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { formatDate, formatINR } from "@/lib/format";
import { ROYALTY_PAYOUT_THRESHOLD } from "@/lib/constants";
import { Button, Card, EmptyState, ErrorBanner, Spinner } from "@/components/ui";

export default function MyBooksPage() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    api("/api/books")
      .then((json) => setState({ loading: false, ...json }))
      .catch((error) => setState({ loading: false, error }));
  }, []);

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorBanner error={state.error} />;

  const { data: books, summary } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Books</h1>
          <p className="text-sm text-gray-500">Sales and royalties for every book you publish with BookLeaf.</p>
        </div>
        <Link href="/author/tickets/new">
          <Button>Need help? Raise a ticket</Button>
        </Link>
      </div>

      <RoyaltySummary summary={summary} />

      {books.length === 0 ? (
        <EmptyState title="No books yet">Once your manuscript is received, your book will appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoyaltySummary({ summary }) {
  return (
    <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
      <Stat label="Total royalty earned" value={formatINR(summary.totalEarned)} />
      <Stat label="Paid to you" value={formatINR(summary.totalPaid)} />
      <Stat label="Pending" value={formatINR(summary.totalPending)} />
      <Stat
        label="Next payout"
        value={summary.nextPayoutDate ? `by ${formatDate(summary.nextPayoutDate)}` : "—"}
        note={
          summary.totalPending === 0
            ? "Nothing pending right now"
            : summary.meetsThreshold
              ? `${summary.nextPayoutQuarter} royalties`
              : `Below the ${formatINR(ROYALTY_PAYOUT_THRESHOLD)} minimum — rolls over (${formatINR(summary.shortfallToThreshold)} to go)`
        }
      />
    </Card>
  );
}

function Stat({ label, value, note }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function BookCard({ book: b }) {
  const inProduction = b.status === "IN_PRODUCTION";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">{b.title}</h2>
          <p className="text-sm text-gray-500">{b.genre}</p>
        </div>
        {inProduction ? (
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            In production · {b.productionStage}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Published & Live</span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="ISBN" value={<span className="font-mono text-xs">{b.isbn}</span>} />
        <Row label="Published" value={inProduction ? "Not yet" : formatDate(b.publicationDate)} />
        <Row label="MRP" value={inProduction ? "Set at publication" : formatINR(b.mrp)} />
        <Row label="Copies sold" value={b.copiesSold.toLocaleString("en-IN")} />
        <Row label="Royalty earned" value={formatINR(b.royaltyEarned)} />
        <Row label="Royalty paid" value={formatINR(b.royaltyPaid)} />
        <Row
          label="Royalty pending"
          value={<span className={b.royaltyPending > 0 ? "font-medium text-amber-700" : ""}>{formatINR(b.royaltyPending)}</span>}
        />
        <Row label="Last payout" value={b.lastPayoutDate ? formatDate(b.lastPayoutDate) : inProduction ? "—" : "No payout yet"} />
      </dl>

      {inProduction ? (
        <p className="mt-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Sales and royalties will appear here once your book is published. We email you at every production stage.
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">Available on: {b.availableOn.join(", ") || "—"}</p>
      )}
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
