// Builds the compact "facts" block the drafter sees. Only data relevant to the
// ticket goes in: the referenced book in full, other books as one line each,
// and royalty facts pre-computed in code.
import { formatDate, formatINR, royaltySummary } from "@/lib/royalty";

function bookLine(b) {
  if (b.status === "IN_PRODUCTION") {
    return `"${b.title}" (${b.id}) — IN PRODUCTION, current stage: ${b.productionStage ?? "unknown"}; ISBN ${b.isbn}; no sales or royalties yet.`;
  }
  return `"${b.title}" (${b.id}) — Published & Live; ISBN ${b.isbn}; MRP ${formatINR(b.mrp)}; ${b.copiesSold} copies sold; royalty earned ${formatINR(b.royaltyEarned)}, paid ${formatINR(b.royaltyPaid)}, pending ${formatINR(b.royaltyPending)}; last payout ${b.lastPayoutDate ? formatDate(b.lastPayoutDate) : "never"}.`;
}

function bookDetail(b) {
  const lines = [
    `Title: "${b.title}" (${b.id}), genre: ${b.genre}`,
    `ISBN: ${b.isbn}`,
  ];
  if (b.status === "IN_PRODUCTION") {
    lines.push(`Status: IN PRODUCTION — current stage: ${b.productionStage ?? "unknown"}`);
    lines.push("Not yet published: no MRP, sales or royalties yet; not yet listed on any platform.");
  } else {
    lines.push(`Status: Published & Live since ${formatDate(b.publicationDate)}`);
    lines.push(`MRP: ${formatINR(b.mrp)}; author royalty per copy: ${formatINR(b.royaltyPerCopy)}`);
    lines.push(`Copies sold: ${b.copiesSold}`);
    lines.push(`Royalty earned: ${formatINR(b.royaltyEarned)}; paid: ${formatINR(b.royaltyPaid)}; pending: ${formatINR(b.royaltyPending)}`);
    lines.push(`Last royalty payout: ${b.lastPayoutDate ? formatDate(b.lastPayoutDate) : "none yet"}`);
    lines.push(`Print partner: ${b.printPartner ?? "—"}`);
    lines.push(`Listed on: ${b.availableOn.length ? b.availableOn.join(", ") : "not listed yet"}`);
  }
  return lines.join("\n");
}

/**
 * @param ticket  ticket with { book, author: { name, joinedDate, books[] } }
 * @param includeRoyalty whether to add the account-level royalty facts
 */
export function buildAccountContext(ticket, { includeRoyalty }) {
  const { author, book } = ticket;
  const parts = [`Author: ${author.name} (author since ${formatDate(author.joinedDate)})`];

  if (book) {
    parts.push(`Book this ticket is about:\n${bookDetail(book)}`);
    const others = author.books.filter((b) => b.id !== book.id);
    if (others.length) parts.push(`Author's other books:\n${others.map((b) => `- ${bookLine(b)}`).join("\n")}`);
  } else {
    parts.push(`Ticket is account-level (no specific book). Author's books:\n${author.books.map((b) => `- ${bookLine(b)}`).join("\n")}`);
  }

  if (includeRoyalty) {
    const r = royaltySummary(author.books);
    const facts = [
      `Account royalty totals: earned ${formatINR(r.totalEarned)}, paid ${formatINR(r.totalPaid)}, pending ${formatINR(r.totalPending)}.`,
      r.meetsThreshold
        ? `Pending balance meets the ₹1,000 payout threshold.`
        : `Pending balance is BELOW the ₹1,000 threshold by ${formatINR(r.shortfallToThreshold)}; it rolls over to the next quarter (this is policy, not a missed payment).`,
      `Most recent payout to this author: ${r.lastPayout ? formatDate(r.lastPayout) : "none ever"}.`,
      r.nextPayout ? `Next scheduled payout: by ${formatDate(r.nextPayout.date)} (for ${r.nextPayout.quarterLabel} royalties).` : null,
      r.looksOverdue
        ? `ATTENTION: ${r.monthsWithoutPayout} months without any payout while above the threshold — treat as genuinely overdue on BookLeaf's side: own it, escalate to the finance team, promise an update within 48 hours.`
        : null,
      `Bank account linkage is not visible in this system — ask the author to confirm their bank details are linked in the dashboard if relevant.`,
    ].filter(Boolean);
    parts.push(facts.join("\n"));
  }

  return parts.join("\n\n");
}
