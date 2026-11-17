// Shared enums + display labels. Safe to import from both client and server code.

export const CATEGORIES = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION: "Distribution & Availability",
  PRODUCTION_STATUS: "Book Status & Production Updates",
  GENERAL: "General Inquiry",
};

export const PRIORITIES = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const STATUSES = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS"];

/**
 * Target first-response time per priority (hours). Used to flag tickets that
 * are breaching their target in the admin queue. Mirrors the 48-hour
 * escalation promise in the BookLeaf tone guidelines.
 */
export const RESPONSE_TARGET_HOURS = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
};

export const ROYALTY_PAYOUT_THRESHOLD = 1000; // ₹ — below this, royalties roll over

export const LABEL_SOURCES = {
  AI: "AI",
  RULES: "Auto (rules)",
  ADMIN: "Admin",
};
