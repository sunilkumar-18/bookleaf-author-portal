"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/client/usePolling";
import { CATEGORIES, PRIORITIES, RESPONSE_TARGET_HOURS, STATUSES } from "@/lib/constants";
import { Button, Card, CategoryBadge, EmptyState, ErrorBanner, PriorityBadge, Spinner, StatusBadge, inputClass, timeAgo } from "@/components/ui";

const DEFAULT_FILTERS = { status: "active", category: "", priority: "", assignee: "any", from: "", to: "", q: "" };

export default function TicketQueuePage() {
  const router = useRouter();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "25" });
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    return `/api/tickets?${p}`;
  }, [filters, page]);

  const { data, error, loading } = usePolling(query, 10000);

  const set = (key) => (e) => {
    setPage(1);
    setFilters({ ...filters, [key]: e.target.value });
  };

  const isFiltered = !sameFilters(filters, DEFAULT_FILTERS);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Ticket Queue</h1>
        <p className="text-sm text-gray-500">Sorted by urgency: highest priority first, then oldest. Refreshes automatically.</p>
      </div>

      {data?.summary && (
        <Summary s={data.summary} filters={filters} onPick={(f) => { setPage(1); setFilters({ ...DEFAULT_FILTERS, ...f }); }} />
      )}

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              placeholder="Search by subject, author name or #number"
              value={filters.q}
              onChange={set("q")}
              aria-label="Search tickets"
            />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {data?.pagination && (
              <span className="whitespace-nowrap text-sm text-gray-500">
                {data.pagination.total} {data.pagination.total === 1 ? "ticket" : "tickets"}
              </span>
            )}
            {isFiltered && (
              <Button variant="ghost" onClick={() => { setPage(1); setFilters(DEFAULT_FILTERS); }}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.7fr)]">
          <FilterField label="Status">
            <select className={inputClass} value={filters.status} onChange={set("status")}>
              <option value="active">Unresolved</option>
              <option value="all">All statuses</option>
              {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FilterField>
          <FilterField label="Category">
            <select className={inputClass} value={filters.category} onChange={set("category")}>
              <option value="">All categories</option>
              {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FilterField>
          <FilterField label="Priority">
            <select className={inputClass} value={filters.priority} onChange={set("priority")}>
              <option value="">All priorities</option>
              {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FilterField>
          <FilterField label="Assignee">
            <select className={inputClass} value={filters.assignee} onChange={set("assignee")}>
              <option value="any">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </FilterField>
          {/* min-w-0: a fieldset defaults to min-width: min-content, which lets the date inputs overflow the grid */}
          <fieldset className="col-span-2 min-w-0 sm:col-span-4 lg:col-span-1">
            <legend className="mb-1 text-xs font-medium text-gray-600">Created between</legend>
            <div className="flex items-center gap-2">
              <input type="date" className={`${inputClass} min-w-0 flex-1`} value={filters.from} max={filters.to || undefined} onChange={set("from")} aria-label="Created from" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" className={`${inputClass} min-w-0 flex-1`} value={filters.to} min={filters.from || undefined} onChange={set("to")} aria-label="Created to" />
            </div>
          </fieldset>
        </div>
      </Card>

      <ErrorBanner error={error} />

      {loading && !data ? (
        <Spinner />
      ) : data?.data.length === 0 ? (
        <EmptyState title="No tickets match these filters">
          {filters.status === "active" ? "Nothing unresolved — nice work." : "Try clearing some filters."}
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((t) => (
                <tr key={t.id} onClick={() => router.push(`/admin/tickets/${t.id}`)} className={`cursor-pointer border-b border-gray-100 hover:bg-brand-50/40 ${t.priority === "CRITICAL" && t.status !== "RESOLVED" && t.status !== "CLOSED" ? "bg-red-50/60" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      <span className="mr-2 font-mono text-xs text-gray-400">#{t.number}</span>
                      {t.subject}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.author?.name} · {t.book?.title ?? "General / Account"}
                    </div>
                  </td>
                  <td className="px-3 py-2"><PriorityBadge priority={t.priority} source={t.prioritySource} /></td>
                  <td className="px-3 py-2"><CategoryBadge category={t.category} source={t.categorySource} />{t.aiStatus === "PENDING" && <span className="ml-1 text-xs text-violet-600">AI…</span>}</td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2 text-gray-600">{t.assignee?.name ?? <span className="text-gray-400">Unassigned</span>}</td>
                  <td className="px-3 py-2"><Age ticket={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data?.pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-gray-500">Page {page} of {data.pagination.totalPages}</span>
          <Button variant="secondary" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

/** Age, highlighted red when an unanswered ticket is past its response target. */
function Age({ ticket: t }) {
  const hours = (Date.now() - new Date(t.createdAt).getTime()) / 3600000;
  const overdue = !t.firstResponseAt && ["OPEN", "IN_PROGRESS"].includes(t.status) && hours > RESPONSE_TARGET_HOURS[t.priority];
  return (
    <div>
      <span className={overdue ? "font-semibold text-red-700" : "text-gray-600"}>{timeAgo(t.createdAt)}</span>
      {overdue && <div className="text-xs text-red-600">No reply · target {RESPONSE_TARGET_HOURS[t.priority]}h</div>}
      {!overdue && !t.firstResponseAt && ["OPEN", "IN_PROGRESS"].includes(t.status) && <div className="text-xs text-gray-400">Awaiting reply</div>}
    </div>
  );
}

const sameFilters = (a, b) => Object.keys(DEFAULT_FILTERS).every((k) => (a[k] ?? "") === (b[k] ?? ""));

function FilterField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function SearchIcon() {
  return (
    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="9" r="6" />
      <path d="m14 14 4 4" strokeLinecap="round" />
    </svg>
  );
}

/** Counter tiles double as one-click quick filters; the tile matching the current filters is highlighted. */
function Summary({ s, filters, onPick }) {
  const tiles = [
    { label: "Open", value: s.open, filter: { status: "OPEN" } },
    { label: "In progress", value: s.inProgress, filter: { status: "IN_PROGRESS" } },
    { label: "Critical (unresolved)", value: s.critical, filter: { priority: "CRITICAL" }, alert: s.critical > 0 },
    { label: "Unassigned", value: s.unassigned, filter: { assignee: "unassigned" } },
    { label: "Assigned to me", value: s.mine, filter: { assignee: "me" } },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => {
        const active = sameFilters(filters, { ...DEFAULT_FILTERS, ...t.filter });
        const border = active ? "border-brand-500 ring-1 ring-brand-500" : t.alert ? "border-red-300" : "border-gray-200";
        return (
          <button
            key={t.label}
            type="button"
            aria-pressed={active}
            title={`Show ${t.label.toLowerCase()} tickets`}
            onClick={() => onPick(active ? {} : t.filter)}
            className={`group rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${border} ${active ? "bg-brand-50" : ""}`}
          >
            <div className={`text-2xl font-semibold ${t.alert ? "text-red-700" : active ? "text-brand-700" : "text-gray-900"}`}>{t.value}</div>
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>{t.label}</span>
              <span className={`transition ${active ? "text-brand-700" : "text-gray-300 group-hover:text-brand-500"}`} aria-hidden="true">
                {active ? "✓" : "→"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
