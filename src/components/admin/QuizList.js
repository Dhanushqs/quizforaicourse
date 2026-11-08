"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { StatusBadge, btnPrimary, card } from "./ui";
import { formatDateTime } from "@/lib/format";

// Home screen of the admin area: all quizzes.
export default function QuizList({ onOpen, onNew }) {
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/admin/quizzes")
      .then((data) => setQuizzes(data.quizzes))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Your quizzes</h2>
        <button onClick={onNew} className={btnPrimary}>
          + New quiz from study material
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!quizzes && !error && <p className="mt-6 text-slate-500">Loading…</p>}

      {quizzes && quizzes.length === 0 && (
        <div className={`${card} mt-6 text-center text-slate-600`}>
          No quizzes yet. Click <strong>New quiz from study material</strong> to upload a PDF or DOCX.
        </div>
      )}

      <div className="mt-5 grid gap-3">
        {quizzes?.map((quiz) => (
          <button
            key={quiz.id}
            onClick={() => onOpen(quiz.id)}
            className={`${card} text-left transition hover:ring-indigo-300`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold">{quiz.title}</span>
              <StatusBadge status={quiz.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {quiz.question_count} questions · {quiz.duration_minutes} min · {quiz.submitted_count} submitted /{" "}
              {quiz.attempt_count} started · created {formatDateTime(quiz.created_at)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
