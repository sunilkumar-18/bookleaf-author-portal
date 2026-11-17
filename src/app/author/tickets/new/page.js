"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fieldErrors } from "@/lib/client/api";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";

const MAX_ATTACHMENT_MB = 10;

export default function NewTicketPage() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState({ bookId: "GENERAL", subject: "", description: "" });
  const [attachment, setAttachment] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api("/api/books").then((json) => setBooks(json.data)).catch(setError);
  }, []);

  function onFile(e) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setErrors({ ...errors, attachmentName: `File must be under ${MAX_ATTACHMENT_MB} MB` });
      e.target.value = "";
      return;
    }
    setErrors({ ...errors, attachmentName: undefined });
    setAttachment(file);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setError(null);
    try {
      // Attachments are UI-only in this version: we record the file name so the
      // team knows the author has a file to share (see README limitations).
      const { data } = await api("/api/tickets", {
        method: "POST",
        body: { ...form, attachmentName: attachment?.name ?? null },
      });
      router.push(`/author/tickets?created=${data.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/author/tickets" className="text-sm text-brand-700 hover:underline">
          ← My Tickets
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">Raise a support ticket</h1>
        <p className="text-sm text-gray-500">Our team usually replies within 24–48 hours. You&apos;ll see the reply under My Tickets.</p>
      </div>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Which book is this about?" error={errors.bookId}>
            <select className={inputClass} value={form.bookId} onChange={(e) => setForm({ ...form, bookId: e.target.value })}>
              <option value="GENERAL">General / Account level</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                  {b.status === "IN_PRODUCTION" ? ` (in production — ${b.productionStage})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Subject" error={errors.subject}>
            <input
              className={inputClass}
              maxLength={150}
              placeholder="e.g. Royalty for last quarter not received"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>

          <Field label="Describe the issue" error={errors.description} hint="Include dates, platforms, order numbers or amounts — it helps us resolve this faster.">
            <textarea
              className={`${inputClass} min-h-40`}
              maxLength={5000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <Field label="Attachment (optional)" error={errors.attachmentName} hint={`Photos of defective copies, screenshots, etc. Max ${MAX_ATTACHMENT_MB} MB.`}>
            <input type="file" accept="image/*,.pdf" onChange={onFile} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:text-brand-700" />
          </Field>

          {!Object.keys(errors).length && <ErrorBanner error={error} />}

          <div className="flex justify-end gap-2">
            <Link href="/author/tickets">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit ticket"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
