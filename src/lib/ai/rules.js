// Deterministic keyword classifier. Two jobs:
//  1. Instant first label at ticket creation (the queue is never unlabeled, even
//     if the AI is slow or down).
//  2. Fallback when the AI is unavailable.

const CATEGORY_RULES = [
  { category: "ISBN_METADATA", pattern: /\bisbn\b|metadata|wrong (book|title|author name)|imprint|barcode|\b(error|mistake|typo|incorrect)\b[^.?!]{0,30}\b(bio|description|title|author name)\b/i },
  // "Can I update my description/bio?" is a how-to question (General in the brief), even when it names a
  // platform — checked before Distribution so "on Amazon" doesn't pull it there.
  { category: "GENERAL", pattern: /\b(update|change|edit)\b[^.?!]{0,40}\b(description|bio|biography|keywords|author photo)\b/i },
  { category: "PRINTING_QUALITY", pattern: /print(ing)? quality|misprint|blurr|binding|pages? (missing|misaligned|torn|loose)|defect|smudg|colou?r (issue|inconsisten)|author copies|reprint/i },
  { category: "DISTRIBUTION", pattern: /unavailable|not available|out of stock|not (showing|listed|visible)|listing|amazon|flipkart|bookleaf store|buy (link|page)/i },
  { category: "ROYALTY_PAYMENTS", pattern: /royalt|payment|payout|paid|bank|earning|money|₹|rs\.?\s?\d|invoice|tax|tds/i },
  { category: "PRODUCTION_STATUS", pattern: /typesetting|cover design|proof ?read|editing|manuscript|production|stage|when will.*(publish|ready|done|live)|status of my book/i },
];

const CRITICAL_PATTERN = /legal|lawyer|lawsuit|fraud|scam|copyright|plagiari|(no|not|never)[^.]{0,40}(royalt|paid|payment)[^.]{0,40}(year|[6-9] months|1[0-9] months)|terminate|cancel my contract/i;
const HIGH_PATTERN = /urgent|asap|immediately|wrong (book|isbn)|duplicate isbn|still (not|haven'?t)|months? (and|but) (no|still)|unavailable|misprint|defect|blurr|misaligned|overdue|not received/i;
const LOW_PATTERN = /\b(bio|biography|description|update my (profile|photo|details)|how (do|can) i|is it possible|can i|curious|question about)\b/i;

export function classifyByRules(subject, description) {
  const text = `${subject}\n${description}`;
  const category = CATEGORY_RULES.find((r) => r.pattern.test(text))?.category ?? "GENERAL";

  let priority = "MEDIUM";
  if (CRITICAL_PATTERN.test(text)) priority = "CRITICAL";
  else if (HIGH_PATTERN.test(text)) priority = "HIGH";
  else if (LOW_PATTERN.test(text)) priority = "LOW";

  return enforcePolicy({ category, priority }, text);
}

const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * Business rules that override any classifier (AI or keyword):
 * the knowledge base says ISBN errors are always high priority.
 */
export function enforcePolicy({ category, priority, ...rest }, text) {
  let p = priority;
  const isIsbnError = category === "ISBN_METADATA" && /\bisbn\b/i.test(text) && /wrong|different|duplicate|incorrect|mismatch|error/i.test(text);
  if (isIsbnError && PRIORITY_ORDER.indexOf(p) < PRIORITY_ORDER.indexOf("HIGH")) p = "HIGH";
  return { ...rest, category, priority: p };
}
