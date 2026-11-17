"use client";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fieldErrors } from "@/lib/client/api";
import { Button, Card, ErrorBanner, Field, inputClass } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { label: "Author (Priya Sharma)", email: "priya.sharma@email.com", password: "author123" },
  { label: "Author with books in production (Sneha)", email: "sneha.kulkarni@email.com", password: "author123" },
  { label: "Admin (Ops team)", email: "admin@bookleaf.com", password: "admin123" },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrors({});
    try {
      const { data } = await api("/api/auth/login", { method: "POST", body: form });
      const home = data.user.role === "ADMIN" ? "/admin" : "/author";
      // Only follow ?next= within the user's own portal.
      router.replace(next && next.startsWith(home) ? next : home);
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm overflow-hidden p-6 pt-0">
      <div className="-mx-6 mb-6 h-1 bg-brand-500" />
      <Image src="/brand/bookleaf-logo.webp" alt="BookLeaf Publishing — www.bookleafpub.in" width={360} height={162} priority className="mx-auto mb-4 h-24 w-auto" />
      <h1 className="text-xl font-semibold text-gray-900">Sign in to BookLeaf</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">Author Support & Communication Portal</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        {!Object.keys(errors).length && <ErrorBanner error={error} />}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Demo accounts</p>
        <ul className="space-y-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => setForm({ email: a.email, password: a.password })}
                className="text-left text-sm text-brand-700 hover:underline"
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
