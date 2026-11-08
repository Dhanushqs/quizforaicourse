import { HttpError, json, readJson, withErrors } from "@/lib/http";
import { finalizeAttempt, getAttemptByToken, getQuizTitle, resultPayload } from "@/lib/quiz";
import { GRACE_SECONDS, isUuid, mergeAnswers } from "@/lib/logic";

// POST /api/quiz/submit  { token, answers, auto }
// Grades the attempt ON THE SERVER and stores the score permanently.
// Safe to call more than once: a submitted attempt is never graded again.
export const POST = withErrors(async (request) => {
  const body = await readJson(request);
  if (!isUuid(body.token)) throw new HttpError(404, "Quiz attempt not found.");

  const attempt = await getAttemptByToken(body.token);
  if (!attempt) throw new HttpError(404, "Quiz attempt not found.");

  const quizTitle = await getQuizTitle(attempt.quiz_id);

  // Already submitted (double click, refresh, retry): just return the saved result.
  if (attempt.status === "submitted") return json(resultPayload(attempt, quizTitle));

  const now = new Date();
  const expires = new Date(attempt.expires_at);
  const late = now.getTime() > expires.getTime() + GRACE_SECONDS * 1000;

  // SERVER-SIDE TIMER CHECK:
  // after the deadline (+ small grace) answers sent by the browser are ignored;
  // only answers that were auto-saved before the deadline count.
  const answers = late
    ? attempt.answers
    : mergeAnswers(attempt.answers, body.answers, attempt.question_order);

  const saved = await finalizeAttempt(attempt, {
    answers,
    submitType: late ? "expired" : body.auto ? "timeout" : "manual",
    submittedAt: late ? expires : now,
  });

  return json(resultPayload(saved, quizTitle));
});
