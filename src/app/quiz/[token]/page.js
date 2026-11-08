"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { formatDuration } from "@/lib/format";

const LETTERS = ["A", "B", "C", "D"];

const clock = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

// The page a student sees while taking the quiz (URL: /quiz/<secret token>).
export default function QuizPage() {
  const { token } = useParams();

  const [phase, setPhase] = useState("loading"); // loading | error | quiz | done
  const [errorMsg, setErrorMsg] = useState("");
  const [data, setData] = useState(null); // the attempt: questions, deadline...
  const [result, setResult] = useState(null);
  const [answers, setAnswers] = useState({}); // { questionId: chosen position 0-3 }
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saveWarning, setSaveWarning] = useState(false);

  // "Refs" hold values that change without needing to redraw the page.
  const offsetRef = useRef(0); // server clock minus this device's clock
  const expiresRef = useRef(0); // deadline in milliseconds
  const submittingRef = useRef(false);
  const lastAutoTryRef = useRef(0);
  const answersRef = useRef({});
  answersRef.current = answers;

  const secondsRemaining = () =>
    Math.max(0, Math.ceil((expiresRef.current - (Date.now() + offsetRef.current)) / 1000));

  const finish = useCallback((payload) => {
    try {
      localStorage.removeItem("quiz_attempt");
    } catch {
      /* ignore */
    }
    setResult(payload);
    setPhase("done");
  }, []);

  // 1) Load the attempt from the server (also runs again after every refresh).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quiz/attempt?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(body.error || "Could not load the quiz.");
          setPhase("error");
          return;
        }
        if (body.status === "submitted") {
          finish(body);
          return;
        }
        // The deadline comes from the SERVER. We correct for a wrong clock on this device.
        offsetRef.current = Date.parse(body.serverNow) - Date.now();
        expiresRef.current = Date.parse(body.expiresAt);
        setData(body);
        setAnswers(body.answers || {});
        setSecondsLeft(secondsRemaining());
        setPhase("quiz");
      } catch {
        if (!cancelled) {
          setErrorMsg("Could not reach the server. Check your internet connection and refresh the page.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, finish]);

  // 2) Submit (manually, or automatically when the timer hits zero).
  const submit = useCallback(
    async (auto = false) => {
      if (submittingRef.current) return;
      if (auto) {
        if (Date.now() - lastAutoTryRef.current < 3000) return; // retry at most every 3 s
        lastAutoTryRef.current = Date.now();
      }
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError("");
      try {
        const res = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, answers: answersRef.current, auto }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Submit failed");
        finish(body);
      } catch (err) {
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitError(`Could not submit yet (${err.message}). ${auto ? "Retrying automatically…" : "Please try again."}`);
      }
    },
    [token, finish]
  );

  // 3) The countdown. It recalculates from the deadline every half second,
  //    so it stays correct even if the browser tab was sleeping.
  useEffect(() => {
    if (phase !== "quiz") return;
    const timer = setInterval(() => {
      const left = secondsRemaining();
      setSecondsLeft(left);
      if (left <= 0) submit(true);
    }, 500);
    return () => clearInterval(timer);
  }, [phase, submit]);

  // 4) Save each answer on the server the moment it is chosen.
  function choose(questionId, position) {
    if (submittingRef.current) return;
    setAnswers((prev) => ({ ...prev, [questionId]: position }));
    fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, questionId, choice: position }),
    })
      .then((res) => setSaveWarning(!res.ok && res.status !== 409))
      .catch(() => setSaveWarning(true));
  }

  function confirmSubmit() {
    const total = data.questions.length;
    const unanswered = total - Object.keys(answers).length;
    const message =
      unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway? You cannot change answers afterwards.`
        : "Submit your quiz? You cannot change answers afterwards.";
    if (window.confirm(message)) submit(false);
  }

  // ---------- screens ----------
  if (phase === "loading") {
    return <Centered>Loading your quiz…</Centered>;
  }

  if (phase === "error") {
    return (
      <Centered>
        <p className="font-semibold text-red-700">{errorMsg}</p>
        <a href="/" className="mt-4 inline-block text-indigo-600 underline">
          Back to home
        </a>
      </Centered>
    );
  }

  if (phase === "done") {
    const percent = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">{result.quizTitle}</p>
          <h1 className="mt-2 text-xl font-bold">Quiz submitted, {result.username}!</h1>
          <p className="mt-6 text-6xl font-extrabold text-indigo-600">
            {result.score}
            <span className="text-3xl font-semibold text-slate-400"> / {result.total}</span>
          </p>
          <p className="mt-2 text-lg text-slate-600">{percent}%</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-500">Time taken</p>
              <p className="font-semibold">{formatDuration(result.timeTakenSeconds)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-500">Submitted</p>
              <p className="font-semibold">
                {result.submitType === "manual" ? "By you" : "Automatically (time up)"}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-500">Your result has been saved. You can close this page.</p>
        </div>
      </main>
    );
  }

  // phase === "quiz"
  const questions = data.questions;
  const total = questions.length;
  const question = questions[current];
  const answeredCount = Object.keys(answers).length;
  const lowTime = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.quizTitle}</p>
            <p className="truncate text-xs text-slate-500">{data.username}</p>
          </div>
          <div
            className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
              lowTime ? "animate-pulse bg-red-100 text-red-700" : "bg-indigo-50 text-indigo-700"
            }`}
            aria-label="Time left"
          >
            {secondsLeft === null ? "--:--" : clock(secondsLeft)}
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-1 bg-indigo-500 transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto mt-6 grid max-w-4xl gap-6 px-4 lg:grid-cols-[1fr_260px]">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <p className="text-sm font-medium text-indigo-600">
            Question {current + 1} of {total}
          </p>
          <h2 className="mt-2 whitespace-pre-wrap text-lg font-semibold leading-snug sm:text-xl">{question.text}</h2>

          <div className="mt-6 space-y-3">
            {question.options.map((option, i) => {
              const selected = answers[question.id] === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => choose(question.id, i)}
                  disabled={submitting}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                    selected
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{option}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            {current < total - 1 ? (
              <button
                type="button"
                onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Submit quiz
              </button>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold">
            Answered {answeredCount} / {total}
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={`aspect-square rounded-lg text-sm font-semibold ${
                  i === current ? "ring-2 ring-indigo-600 ring-offset-1" : ""
                } ${answers[q.id] !== undefined ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={confirmSubmit}
            disabled={submitting}
            className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit quiz"}
          </button>

          {saveWarning && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Your last answer may not have been saved. Check your internet connection.
            </p>
          )}
          {submitError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{submitError}</p>}
        </aside>
      </main>
    </div>
  );
}

function Centered({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center text-slate-600">
      <div>{children}</div>
    </main>
  );
}
