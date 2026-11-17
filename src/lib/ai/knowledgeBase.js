// BookLeaf Knowledge Base, split into sections so each prompt only carries the
// policy relevant to the ticket's category (cost control: a royalty question
// does not need the printing policy). Text is taken from the assignment brief.

const SECTIONS = {
  COMPANY: `Company overview:
- BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid package with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.
- In-house printing facility and warehouse in Delhi; print partners include Repro India and Epitome Books.`,

  ROYALTY: `Royalty policy:
- 80/20 split: 80% of the net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is ₹1,000 (accumulated). Below this, royalties roll over to the next quarter.
- Payouts are made by bank transfer to the account linked in the author's dashboard.
- Authors can view a detailed royalty breakdown (sales per platform) in their dashboard.`,

  ISBN: `ISBN policy:
- Every book published through BookLeaf receives a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- An author who wants an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked, mismatch between platform and physical copy) are HIGH PRIORITY and escalated to the production team. Resolution timeline: 48 hours.`,

  METADATA: `Metadata updates:
- Metadata (description, author bio, keywords, etc.) can be updated after a book is live, via the dashboard or by emailing the BookLeaf team.
- Changes typically reflect on platforms within 3–5 business days.`,

  PRINTING: `Printing & quality:
- In-house printing handles most orders; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5–7 business days from order confirmation.
- Quality issues (misprints, binding defects, colour inconsistency): BookLeaf arranges a FREE reprint after verification. The author may need to share photos of the defective copy. Reprint timeline: 5–7 business days once verified.`,

  DISTRIBUTION: `Distribution & availability:
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings typically go live within 7–10 business days after publication is complete.
- "Unavailable" on a platform usually indicates a stock sync issue; BookLeaf's team can trigger a re-sync, live again within 24–48 hours.`,

  PRODUCTION: `Production stages (in order):
Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live.
- Authors are updated by email at each stage.
- Delays typically happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).
- Never blame the author for a delay, even if it is on their side; frame it collaboratively.`,
};

/** One calibrated example per category (from the brief's sample query → response table). */
const EXAMPLES = {
  ROYALTY_PAYMENTS: `Query: "I published my book 4 months ago and still haven't received any royalty. What's going on?"
Good response: acknowledges the frustration; explains the quarterly cycle and 45-day payout window; checks whether bank details are linked; gives the specific next payout date; if genuinely overdue, escalates with a 48-hour resolution timeline.
Query: "My royalty seems too low. I sold 200 copies but only received ₹3,000."
Good response: explains net profit (MRP minus printing, platform commission, shipping) without being defensive; offers a detailed line-by-line royalty breakdown.`,
  ISBN_METADATA: `Query: "My book is showing a different ISBN on Amazon than what's on the physical copy."
Good response: treats it as high priority; acknowledges it is a serious data issue and BookLeaf's responsibility; confirms immediate escalation to the production team; gives a 48-hour resolution timeline.`,
  PRINTING_QUALITY: `Query: "I received my author copies and the print quality is terrible. Images are blurry and pages misaligned."
Good response: apologises sincerely; asks for photos of the defective copies; confirms a free reprint once verified; gives a 5–7 business day reprint timeline.`,
  DISTRIBUTION: `Query: "My book is published but it's showing as 'Currently Unavailable' on Amazon."
Good response: explains this is typically a stock sync issue; confirms the team is triggering a re-sync; sets the expectation of 24–48 hours.`,
  PRODUCTION_STATUS: `Query: "It's been 3 weeks and my book is still in typesetting. When will it be done?"
Good response: states the actual current stage; is honest about the reason for any delay (e.g. waiting on proof approval) without blaming the author; gives a specific updated timeline and next step.`,
  GENERAL: `Query: "Can I update the description of my book on Amazon after it's already live?"
Good response: yes — submit through the dashboard or by emailing the team; changes typically reflect within 3–5 business days.`,
};

/** Which KB sections each category needs. COMPANY is small and always useful for context. */
const SECTIONS_BY_CATEGORY = {
  ROYALTY_PAYMENTS: ["COMPANY", "ROYALTY"],
  ISBN_METADATA: ["COMPANY", "ISBN", "METADATA"],
  PRINTING_QUALITY: ["COMPANY", "PRINTING"],
  DISTRIBUTION: ["COMPANY", "DISTRIBUTION"],
  PRODUCTION_STATUS: ["COMPANY", "PRODUCTION"],
  GENERAL: ["COMPANY", "METADATA", "ROYALTY", "DISTRIBUTION"],
};

export const TONE_GUIDELINES = `BookLeaf communication tone:
- Always empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before jumping to solutions.
- Be specific: use actual numbers, dates and statuses from the account data instead of vague reassurances.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If escalation or investigation is needed, give a clear timeline (e.g. "within 48 hours"), never open-ended promises.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

export function knowledgeFor(category) {
  const keys = SECTIONS_BY_CATEGORY[category] ?? SECTIONS_BY_CATEGORY.GENERAL;
  return keys.map((k) => SECTIONS[k]).join("\n\n");
}

export function exampleFor(category) {
  return EXAMPLES[category] ?? EXAMPLES.GENERAL;
}
