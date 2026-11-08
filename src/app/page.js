"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// The student home page: shows the open quiz and asks for a username.
export default function HomePage() {
  const router = useRouter();
  const [quiz, setQuiz] = useState(undefined); // undefined = still loading, null = no quiz open
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null); // an unfinished attempt remembered on this device

  useEffect(() => {
    fetch("/api/quiz/info", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setQuiz(data.quiz ?? null);
        try {
          const stored = JSON.parse(localStorage.getItem("quiz_attempt") || "null");
          if (stored && data.quiz && stored.quizId === data.quiz.id) setSaved(stored);
        } catch {
          /* ignore broken saved data */
        }
      })
      .catch(() => {
        setQuiz(null);
        setError("Could not reach the server. Check your internet connection and refresh.");
      });
  }, []);

  async function startQuiz(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start the quiz.");

      // Remember the attempt on this device so a refresh / reopened tab can continue.
      localStorage.setItem("quiz_attempt", JSON.stringify({ quizId: quiz.id, token: data.token }));
      router.push(`/quiz/${data.token}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Online Quiz</p>

        {quiz === undefined && <p className="mt-4 text-slate-500">Loading…</p>}

        {quiz === null && (
          <div className="mt-3">
            <h1 className="text-2xl font-bold">No quiz is open right now</h1>
            <p className="mt-2 text-slate-600">Please wait for your teacher to start the quiz, then refresh this page.</p>
          </div>
        )}

        {quiz && (
          <>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{quiz.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1">{quiz.question_count} questions</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{quiz.duration_minutes} minutes</span>
            </div>

            {saved && (
              <div className="mt-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-sm text-amber-900">You already started this quiz on this device.</p>
                <button
                  onClick={() => router.push(`/quiz/${saved.token}`)}
                  className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-white hover:bg-amber-600"
                >
                  Continue my quiz
                </button>
              </div>
            )}

            <form onSubmit={startQuiz} className="mt-6">
              <label htmlFor="username" className="block text-sm font-medium">
                Your username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                maxLength={30}
                placeholder="e.g. Priya S"
                className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />

              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>The timer starts the moment you press Start.</li>
                <li>Questions and options are in a random order for each student.</li>
                <li>The quiz submits automatically when time is up.</li>
                <li>You cannot change answers after submitting.</li>
              </ul>

              {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={busy || username.trim().length < 2}
                className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Starting…" : "Start quiz"}
              </button>
            </form>
          </>
        )}

        {quiz === null && error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}
