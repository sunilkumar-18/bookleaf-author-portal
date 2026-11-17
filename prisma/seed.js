// Seeds the database from the provided bookleaf_sample_data.json (unchanged),
// creates login accounts, and adds a few demo tickets so the admin queue isn't empty.
// Idempotent: safe to run more than once.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const data = require("./data/bookleaf_sample_data.json");

const prisma = new PrismaClient();

const AUTHOR_PASSWORD = process.env.SEED_AUTHOR_PASSWORD || "author123";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

const ADMINS = [
  { email: "admin@bookleaf.com", name: "Aisha Khan (Ops)" },
  { email: "support@bookleaf.com", name: "Rahul Verma (Support)" },
];

const toDate = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);

/** "Published & Live" -> PUBLISHED; "In Production - Cover Design" -> IN_PRODUCTION + stage */
function parseStatus(raw) {
  if (raw === "Published & Live") return { status: "PUBLISHED", productionStage: null };
  const m = raw.match(/^In Production\s*-\s*(.+)$/);
  if (m) return { status: "IN_PRODUCTION", productionStage: m[1].trim() };
  throw new Error(`Unknown book status: ${raw}`);
}

// Demo tickets based on the sample queries in the brief. Labels are set by the
// seed (source RULES); new tickets created through the app are AI-classified.
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);
const DEMO_TICKETS = [
  {
    author: "AUTH003", book: "BK005", createdAt: hoursAgo(70),
    subject: "No royalty received since my book was published",
    description: "My book Between Two Temples was published in July 2024 and I still haven't received a single royalty payment. My dashboard shows ₹2,546 pending. What is going on? This has been more than a year.",
    category: "ROYALTY_PAYMENTS", priority: "CRITICAL",
  },
  {
    author: "AUTH002", book: "BK004", createdAt: hoursAgo(30),
    subject: "Different ISBN on Amazon vs physical copy",
    description: "My book Startup Sutra is showing a different ISBN on Amazon than what is printed on the physical copy. Readers are confused and I'm worried about sales being tracked wrongly.",
    category: "ISBN_METADATA", priority: "HIGH",
  },
  {
    author: "AUTH005", book: "BK009", createdAt: hoursAgo(20),
    subject: "Book showing Currently Unavailable on Amazon",
    description: "Letters from Lakshadweep is published but it's showing as 'Currently Unavailable' on Amazon India since last week. I have readers asking me where to buy it.",
    category: "DISTRIBUTION", priority: "HIGH",
  },
  {
    author: "AUTH007", book: "BK013", createdAt: hoursAgo(50),
    subject: "When will Midnight in Mysore move forward?",
    description: "It's been 3 weeks and my book is still in cover design. When will it be done? I'd like to plan a launch event.",
    category: "PRODUCTION_STATUS", priority: "MEDIUM",
  },
  {
    author: "AUTH009", book: null, createdAt: hoursAgo(8),
    subject: "Why haven't I been paid for The Nagpur Notebooks?",
    description: "My book has sold 34 copies and shows ₹850 pending, but I haven't received any payout yet. Can you tell me when I will be paid?",
    category: "ROYALTY_PAYMENTS", priority: "MEDIUM",
  },
  {
    author: "AUTH001", book: "BK001", createdAt: hoursAgo(3),
    subject: "Can I update my book description on Amazon?",
    description: "Can I update the description of Whispers of the Ganges on Amazon now that it's already live? I'd like to add a couple of review quotes.",
    category: "GENERAL", priority: "LOW",
  },
];

async function main() {
  const [authorHash, adminHash] = await Promise.all([
    bcrypt.hash(AUTHOR_PASSWORD, 10),
    bcrypt.hash(ADMIN_PASSWORD, 10),
  ]);

  for (const a of data.authors) {
    const author = {
      name: a.name,
      email: a.email.toLowerCase(),
      phone: a.phone,
      city: a.city,
      joinedDate: toDate(a.joined_date),
    };
    await prisma.author.upsert({ where: { id: a.author_id }, update: author, create: { id: a.author_id, ...author } });

    await prisma.user.upsert({
      where: { email: author.email },
      update: { name: a.name, authorId: a.author_id },
      create: { email: author.email, name: a.name, role: "AUTHOR", authorId: a.author_id, passwordHash: authorHash },
    });

    for (const b of a.books) {
      const book = {
        authorId: a.author_id,
        title: b.title,
        isbn: b.isbn,
        genre: b.genre,
        ...parseStatus(b.status),
        publicationDate: toDate(b.publication_date),
        mrp: b.mrp,
        royaltyPerCopy: b.author_royalty_per_copy,
        copiesSold: b.total_copies_sold,
        royaltyEarned: b.total_royalty_earned,
        royaltyPaid: b.royalty_paid,
        royaltyPending: b.royalty_pending,
        lastPayoutDate: toDate(b.last_royalty_payout_date),
        printPartner: b.print_partner,
        availableOn: b.available_on,
      };
      await prisma.book.upsert({ where: { id: b.book_id }, update: book, create: { id: b.book_id, ...book } });
    }
  }

  for (const admin of ADMINS) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name },
      create: { ...admin, role: "ADMIN", passwordHash: adminHash },
    });
  }

  // Demo tickets only on a fresh database.
  if ((await prisma.ticket.count()) === 0) {
    for (const t of DEMO_TICKETS) {
      await prisma.ticket.create({
        data: {
          authorId: t.author,
          bookId: t.book,
          subject: t.subject,
          description: t.description,
          category: t.category,
          categorySource: "RULES",
          priority: t.priority,
          prioritySource: "RULES",
          aiStatus: "DONE",
          aiReasoning: "Seeded demo ticket.",
          createdAt: t.createdAt,
        },
      });
    }
  }

  const counts = await Promise.all([prisma.author.count(), prisma.book.count(), prisma.user.count(), prisma.ticket.count()]);
  console.log(`Seeded: ${counts[0]} authors, ${counts[1]} books, ${counts[2]} users, ${counts[3]} tickets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
