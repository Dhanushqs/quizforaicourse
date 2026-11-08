"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { btnDanger, btnPrimary, btnSecondary, card } from "./ui";
import { formatDateTime, formatDuration } from "@/lib/format";

// Live results table + CSV / Excel download.
export default function ResultsPanel({ quizId }) {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("score");

  const load = useCallback(async () => {
    try {
      const data = await api(`/api/admin/results?quizId=${quizId}`);
      setAttempts(data.attempts);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [quizId]);

  // Load now, then refresh every 15 seconds while this tab is open.
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const { rows, stats } = useMemo(() => {
    const list = [...(attempts || [])];
    const done = list.filter((a) => a.status === "submitted");
    const percents = done.map((a) => (a.total ? (a.score / a.total) * 100 : 0));

    const byScore = (a, b) =>
      (b.score ?? -1) - (a.score ?? -1) || (a.time_taken_seconds ?? 1e9) - (b.time_taken_seconds ?? 1e9);
    if (sort === "score") list.sort(byScore);
    if (sort === "name") list.sort((a, b) => a.username.localeCompare(b.username));
    if (sort === "latest") list.sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || ""));

    return {
      rows: list,
      stats: {
        started: list.length,
        submitted: done.length,
        average: percents.length ? percents.reduce((s, p) => s + p, 0) / percents.length : null,
        highest: percents.length ? Math.max(...percents) : null,
        lowest: percents.length ? Math.min(...percents) : null,
      },
    };
  }, [attempts, sort]);

  async function resetAttempt(attempt) {
    if (!window.confirm(`Delete the attempt of "${attempt.username}"? They will be able to start again.`)) return;
    try {
      await api(`/api/admin/attempts/${attempt.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetAll() {
    if (!window.confirm("Delete ALL student attempts for this quiz? This cannot be undone.")) return;
    try {
      await api(`/api/admin/results?quizId=${quizId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const pct = (v) => (v === null ? "–" : `${Math.round(v)}%`);

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Started" value={stats.started} />
        <Stat label="Submitted" value={stats.submitted} />
        <Stat label="Average" value={pct(stats.average)} />
        <Stat label="Highest" value={pct(stats.highest)} />
        <Stat label="Lowest" value={pct(stats.lowest)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a className={btnPrimary} href={`/api/admin/export?quizId=${quizId}&format=csv`}>
          Download CSV
        </a>
        <a className={btnPrimary} href={`/api/admin/export?quizId=${quizId}&format=xlsx`}>
          Download Excel
        </a>
        <button className={btnSecondary} onClick={load}>
          Refresh
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5"
          >
            <option value="score">Highest score</option>
            <option value="name">Name (A–Z)</option>
            <option value="latest">Latest submitted</option>
          </select>
        </label>
      </div>

      <div className={`${card} overflow-x-auto !p-0`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">%</th>
              <th className="px-4 py-3">Time taken</th>
              <th className="px-4 py-3">Submitted at</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attempts === null && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  Loading…
                </td>
              </tr>
            )}
            {attempts && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={8}>
                  No students have started this quiz yet.
                </td>
              </tr>
            )}
            {rows.map((a, i) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{a.username}</td>
                <td className="px-4 py-3">{a.status === "submitted" ? `${a.score} / ${a.total}` : "–"}</td>
                <td className="px-4 py-3">
                  {a.status === "submitted" && a.total ? `${Math.round((a.score / a.total) * 100)}%` : "–"}
                </td>
                <td className="px-4 py-3">{formatDuration(a.time_taken_seconds) || "–"}</td>
                <td className="px-4 py-3">{formatDateTime(a.submitted_at) || "–"}</td>
                <td className="px-4 py-3">
                  {a.status === "submitted" ? (
                    <span className="text-emerald-700">
                      {a.submit_type === "manual" ? "Submitted" : a.submit_type === "timeout" ? "Auto-submitted" : "Time ran out"}
                    </span>
                  ) : (
                    <span className="text-amber-700">In progress</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-red-600 hover:underline" onClick={() => resetAttempt(a)}>
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button className={btnDanger} onClick={resetAll} disabled={!attempts?.length}>
          Delete all attempts
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Handy after you test the quiz yourself. The list refreshes automatically every 15 seconds.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={`${card} !p-4`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
