import { db } from "@/lib/supabase";
import { HttpError, json, withErrors } from "@/lib/http";
import { finalizeAttempt, getAttemptByToken, getQuizTitle, resultPayload } from "@/lib/quiz";
import { GRACE_SECONDS, isUuid, toStudentQuestions } from "@/lib/logic";

export const dynamic = "force-dynamic";

// GET /api/quiz/attempt?token=...
// Called when the quiz page opens AND after every refresh.
// Returns the student's own questions (same order every time), saved answers,
// and the server deadline. It NEVER includes the correct answers.
export const GET = withErrors(async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!isUuid(token)) throw new HttpError(404, "Quiz attempt not found.");

  let attempt = await getAttemptByToken(token);
  if (!attempt) throw new HttpError(404, "Quiz attempt not found.");

  const now = Date.now();
  const expiresMs = new Date(attempt.expires_at).getTime();

  // Time ran out and the student never came back to submit: grade what was saved.
  if (attempt.status === "in_progress" && now > expiresMs + GRACE_SECONDS * 1000) {
    attempt = await finalizeAttempt(attempt, {
      answers: attempt.answers,
      submitType: "expired",
      submittedAt: new Date(attempt.expires_at),
    });
  }

  const quizTitle = await getQuizTitle(attempt.quiz_id);

  if (attempt.status === "submitted") {
    return json(resultPayload(attempt, quizTitle));
  }

  const ids = attempt.question_order.map((o) => o.id);
  const { data: rows, error } = await db().from("questions").select("id, question, options").in("id", ids);
  if (error) throw error;
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

  return json({
    status: "in_progress",
    username: attempt.username,
    quizTitle,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    serverNow: new Date().toISOString(), // lets the browser correct a wrong clock
    questions: toStudentQuestions(attempt.question_order, byId),
    answers: attempt.answers,
  });
});
