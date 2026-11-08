"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { StatusBadge, btnDanger, btnPrimary, btnSecondary, card, inputClass } from "./ui";

const LETTERS = ["A", "B", "C", "D"];

// Review/edit questions, set the duration, and publish or close the quiz.
export default function QuizEditor({ quizId, onDeleted }) {
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(20);
  const [status, setStatus] = useState("draft");
  const [questions, setQuestions] = useState([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  const locked = attemptCount > 0; // questions can't change once students have started

  const load = useCallback(async () => {
    const data = await api(`/api/admin/quizzes/${quizId}`);
    setTitle(data.quiz.title);
    setDuration(data.quiz.duration_minutes);
    setStatus(data.quiz.status);
    setAttemptCount(data.attemptCount);
    setQuestions(
      data.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
      }))
    );
    setLoaded(true);
  }, [quizId]);

  useEffect(() => {
    setOrigin(window.location.origin);
    load().catch((err) => setError(err.message));
  }, [load]);

  const setQ = (i, patch) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const setOption = (i, j, value) =>
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === i ? { ...q, options: q.options.map((o, k) => (k === j ? value : o)) } : q))
    );
  const addQuestion = () =>
    setQuestions((qs) => [...qs, { id: null, question: "", options: ["", "", "", ""], correct_index: 0 }]);
  const removeQuestion = (i) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));

  async function save(newStatus, successMessage = "Saved.") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { title, duration_minutes: Number(duration) };
      if (!locked) payload.questions = questions;
      if (newStatus) payload.status = newStatus;
      await api(`/api/admin/quizzes/${quizId}`, { method: "PUT", json: payload });
      await load();
      setNotice(successMessage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz() {
    if (!window.confirm("Delete this quiz, its questions AND all student results? This cannot be undone.")) return;
    try {
      await api(`/api/admin/quizzes/${quizId}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!loaded) {
    return error ? (
      <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
    ) : (
      <p className="text-slate-500">Loading…</p>
    );
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <section className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">Quiz settings</h2>
          <StatusBadge status={status} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px]">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              max={300}
              className={`${inputClass} mt-1`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        {status === "published" && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Students can take this quiz now. Share this link: <strong className="break-all">{origin}</strong>
          </p>
        )}
        {locked && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {attemptCount} student attempt(s) exist, so the questions are locked. (Title and duration can still be
            changed; a new duration only affects students who start later.) If those were only test attempts, delete them
            on the Results tab to unlock editing.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btnSecondary} disabled={saving} onClick={() => save(null)}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {status === "draft" && (
            <button
              className={btnPrimary}
              disabled={saving}
              onClick={() => save("published", "Published! Students can now start the quiz.")}
            >
              Save &amp; publish
            </button>
          )}
          {status === "published" && (
            <button
              className={btnPrimary}
              disabled={saving}
              onClick={() => save("closed", "Quiz closed. No new students can start (running attempts can finish).")}
            >
              Close quiz
            </button>
          )}
          {status === "closed" && (
            <button
              className={btnPrimary}
              disabled={saving}
              onClick={() => save("published", "Quiz re-opened for students.")}
            >
              Re-open quiz
            </button>
          )}
          <button className={btnDanger} disabled={saving} onClick={deleteQuiz}>
            Delete quiz
          </button>
        </div>
      </section>

      <h2 className="pt-2 text-lg font-bold">Questions ({questions.length})</h2>
      <p className="-mt-3 text-sm text-slate-600">
        Select the round button next to the correct answer. Students never see which one is correct, and the order is
        shuffled for each student.
      </p>

      {questions.map((q, i) => (
        <section key={q.id || `new-${i}`} className={card}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-indigo-600">Question {i + 1}</p>
            {!locked && (
              <button className="text-sm text-red-600 hover:underline" onClick={() => removeQuestion(i)}>
                Remove
              </button>
            )}
          </div>
          <textarea
            rows={2}
            className={`${inputClass} mt-2`}
            value={q.question}
            disabled={locked}
            onChange={(e) => setQ(i, { question: e.target.value })}
            placeholder="Question text"
          />
          <div className="mt-3 space-y-2">
            {q.options.map((option, j) => (
              <div key={j} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  checked={q.correct_index === j}
                  disabled={locked}
                  onChange={() => setQ(i, { correct_index: j })}
                  className="h-4 w-4 shrink-0 accent-emerald-600"
                  aria-label={`Option ${LETTERS[j]} is correct`}
                />
                <span className="w-5 shrink-0 text-sm font-semibold text-slate-500">{LETTERS[j]}</span>
                <input
                  className={`${inputClass} ${q.correct_index === j ? "border-emerald-500 bg-emerald-50" : ""}`}
                  value={option}
                  disabled={locked}
                  onChange={(e) => setOption(i, j, e.target.value)}
                  placeholder={`Option ${LETTERS[j]}`}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {!locked && (
        <div className="flex flex-wrap gap-3">
          <button className={btnSecondary} onClick={addQuestion}>
            + Add a question
          </button>
          <button className={btnPrimary} disabled={saving} onClick={() => save(null)}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
