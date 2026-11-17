// Small presentational building blocks shared by both portals.
import { CATEGORIES, LABEL_SOURCES, PRIORITIES, STATUSES } from "@/lib/constants";

const cx = (...c) => c.filter(Boolean).join(" ");

export function Card({ className, children }) {
  return <div className={cx("rounded-lg border border-gray-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function Button({ variant = "primary", className, ...props }) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
    secondary: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50",
    ghost: "text-brand-700 hover:bg-brand-50 disabled:opacity-50",
  };
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed", styles[variant], className)}
      {...props}
    />
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Pill({ className, children, title }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const STATUS_STYLE = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-200 text-gray-700",
};
export function StatusBadge({ status }) {
  return <Pill className={STATUS_STYLE[status]}>{STATUSES[status]}</Pill>;
}

const PRIORITY_STYLE = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  LOW: "bg-gray-100 text-gray-600",
};
export function PriorityBadge({ priority, source }) {
  return (
    <Pill className={PRIORITY_STYLE[priority]} title={source ? `Set by: ${LABEL_SOURCES[source]}` : undefined}>
      {PRIORITIES[priority]}
      {source === "AI" && <SourceMark />}
    </Pill>
  );
}

export function CategoryBadge({ category, source }) {
  return (
    <Pill className="bg-brand-50 text-brand-700" title={source ? `Set by: ${LABEL_SOURCES[source]}` : undefined}>
      {CATEGORIES[category]}
      {source === "AI" && <SourceMark />}
    </Pill>
  );
}

function SourceMark() {
  return <span className="rounded bg-violet-600 px-1 text-[10px] font-semibold leading-4 text-white">AI</span>;
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-gray-800">{title}</p>
      {children && <div className="mt-1 text-sm text-gray-500">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error.message ?? String(error)}</div>;
}

export function Spinner({ label = "Loading…" }) {
  return <p className="py-8 text-center text-sm text-gray-500">{label}</p>;
}

export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDateTime(d) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
