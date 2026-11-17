// Royalty schedule logic from the BookLeaf knowledge base:
//  - royalties are calculated quarterly and paid within 45 days of quarter end
//  - minimum payout ₹1,000; smaller balances roll over
// We compute these facts in code and hand them to the model as data, so the
// model never has to do date or currency arithmetic itself (LLMs are bad at it).
import { ROYALTY_PAYOUT_THRESHOLD } from "./constants";

/**
 * "Today" for royalty reasoning. The sample dataset is a snapshot (latest payout
 * 2025-12-01); REFERENCE_DATE lets the demo reason about it as of a fixed date.
 * Unset in production -> real current date.
 */
export function referenceDate() {
  const fromEnv = process.env.REFERENCE_DATE;
  const d = fromEnv ? new Date(`${fromEnv}T00:00:00Z`) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Payout deadline for the quarter ending in `quarterEndMonth` (0-based: 2, 5, 8, 11) of `year`. */
function payoutDeadline(year, quarterEndMonth) {
  const quarterEnd = new Date(Date.UTC(year, quarterEndMonth + 1, 0)); // last day of the quarter
  return new Date(quarterEnd.getTime() + 45 * 24 * 3600 * 1000);
}

/** Next payout deadline on/after `today`, plus the quarter it pays out. */
export function nextPayout(today = referenceDate()) {
  // Walk forward over the quarters around `today` and pick the first deadline not yet passed.
  for (let offset = -1; offset <= 4; offset++) {
    const q = Math.floor(today.getUTCMonth() / 3) + offset;
    const year = today.getUTCFullYear() + Math.floor(q / 4);
    const quarterIndex = ((q % 4) + 4) % 4;
    const deadline = payoutDeadline(year, quarterIndex * 3 + 2);
    if (deadline >= startOfDay(today)) {
      return { date: deadline, quarterLabel: `Q${quarterIndex + 1} ${year}` };
    }
  }
  return null; // unreachable
}

function startOfDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthsBetween(a, b) {
  return Math.max(0, (b.getTime() - a.getTime()) / (30.44 * 24 * 3600 * 1000));
}

/**
 * Account-level royalty facts for one author. The ₹1,000 threshold applies to
 * the author's *accumulated* balance, not per book.
 */
export function royaltySummary(books, today = referenceDate()) {
  const published = books.filter((b) => b.status === "PUBLISHED");
  const totalPending = books.reduce((s, b) => s + b.royaltyPending, 0);
  const totalEarned = books.reduce((s, b) => s + b.royaltyEarned, 0);
  const totalPaid = books.reduce((s, b) => s + b.royaltyPaid, 0);

  const payoutDates = books.map((b) => b.lastPayoutDate).filter(Boolean).map((d) => new Date(d));
  const lastPayout = payoutDates.length ? new Date(Math.max(...payoutDates)) : null;

  const pubDates = published.map((b) => b.publicationDate).filter(Boolean).map((d) => new Date(d));
  const firstPublished = pubDates.length ? new Date(Math.min(...pubDates)) : null;

  const meetsThreshold = totalPending >= ROYALTY_PAYOUT_THRESHOLD;
  // Months the author has gone without any payout (since last payout, or since first publication if never paid).
  const sinceRef = lastPayout ?? firstPublished;
  const monthsWithoutPayout = sinceRef ? Math.round(monthsBetween(sinceRef, today)) : null;

  // Heuristic: a balance above the threshold with no payout for more than two
  // quarterly cycles (~7 months incl. the 45-day window) looks genuinely overdue.
  const looksOverdue = meetsThreshold && monthsWithoutPayout !== null && monthsWithoutPayout >= 7;

  return {
    totalEarned,
    totalPaid,
    totalPending,
    meetsThreshold,
    shortfallToThreshold: meetsThreshold ? 0 : ROYALTY_PAYOUT_THRESHOLD - totalPending,
    lastPayout,
    monthsWithoutPayout,
    looksOverdue,
    nextPayout: nextPayout(today),
  };
}

export { formatDate, formatINR } from "./format";
