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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Ticket Queue</h1>
        <p className="text-sm text-gray-500">Sorted by urgency: highest priority first, then oldest. Refreshes automatically.</p>
      </div>

      {data?.summary && <Summary s={data.summary} onPick={(f) => { setPage(1); setFilters({ ...DEFAULT_FILTERS, ...f }); }} />}

      <Card className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-7">
        <input className={`${inputClass} lg:col-span-2`} placeholder="Search subject, author or #number" value={filters.q} onChange={set("q")} />
        <select className={inputClass} value={filters.status} onChange={set("status")} aria-label="Status">
          <option value="active">Unresolved</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={inputClass} value={filters.category} onChange={set("category")} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={inputClass} value={filters.priority} onChange={set("priority")} aria-label="Priority">
          <option value="">All priorities</option>
          {Object.entries(PRIORITIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={inputClass} value={filters.assignee} onChange={set("assignee")} aria-label="Assignee">
          <option value="any">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <div className="flex items-center gap-1">
          <input type="date" className={inputClass} value={filters.from} onChange={set("from")} aria-label="Created from" />
          <input type="date" className={inputClass} value={filters.to} onChange={set("to")} aria-label="Created to" />
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

function Summary({ s, onPick }) {
  const tiles = [
    { label: "Open", value: s.open, filter: { status: "OPEN" } },
    { label: "In progress", value: s.inProgress, filter: { status: "IN_PROGRESS" } },
    { label: "Critical (unresolved)", value: s.critical, filter: { priority: "CRITICAL" }, alert: s.critical > 0 },
    { label: "Unassigned", value: s.unassigned, filter: { assignee: "unassigned" } },
    { label: "Assigned to me", value: s.mine, filter: { assignee: "me" } },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => onPick(t.filter)} className={`rounded-lg border bg-white px-3 py-2 text-left shadow-sm hover:border-brand-300 ${t.alert ? "border-red-300" : "border-gray-200"}`}>
          <div className={`text-xl font-semibold ${t.alert ? "text-red-700" : "text-gray-900"}`}>{t.value}</div>
          <div className="text-xs text-gray-500">{t.label}</div>
        </button>
      ))}
    </div>
  );
}
