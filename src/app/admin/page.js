"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/admin/api";
import QuizList from "@/components/admin/QuizList";
import NewQuizForm from "@/components/admin/NewQuizForm";
import QuizEditor from "@/components/admin/QuizEditor";
import ResultsPanel from "@/components/admin/ResultsPanel";
import { btnSecondary } from "@/components/admin/ui";

// The admin dashboard (URL: /admin). Every piece of data it shows comes from
// /api/admin/... routes, which refuse anyone who is not a logged-in admin.
export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [view, setView] = useState({ name: "list" }); // list | new | quiz
  const [tab, setTab] = useState("questions"); // questions | results

  // Check the login first. Not logged in? The api() helper redirects to /admin/login.
  useEffect(() => {
    api("/api/admin/me")
      .then((data) => setEmail(data.email))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function openQuiz(id, startTab = "questions") {
    setTab(startTab);
    setView({ name: "quiz", id });
    window.scrollTo({ top: 0 });
  }

  if (!email) {
    return <main className="p-10 text-center text-slate-500">Checking login…</main>;
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <button className="text-lg font-bold" onClick={() => setView({ name: "list" })}>
            Quiz Admin
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
            <button className={btnSecondary} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-4xl px-4">
        {view.name === "list" && <QuizList onOpen={(id) => openQuiz(id, "questions")} onNew={() => setView({ name: "new" })} />}

        {view.name === "new" && (
          <NewQuizForm onCreated={(id) => openQuiz(id, "questions")} onCancel={() => setView({ name: "list" })} />
        )}

        {view.name === "quiz" && (
          <div>
            <button className="mb-4 text-sm text-indigo-600 hover:underline" onClick={() => setView({ name: "list" })}>
              ← All quizzes
            </button>

            <div className="mb-5 flex gap-2 border-b border-slate-200">
              {[
                ["questions", "Questions & settings"],
                ["results", "Results"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                    tab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "questions" && (
              <QuizEditor key={view.id} quizId={view.id} onDeleted={() => setView({ name: "list" })} />
            )}
            {tab === "results" && <ResultsPanel key={view.id} quizId={view.id} />}
          </div>
        )}
      </main>
    </div>
  );
}
