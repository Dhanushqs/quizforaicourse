// Database helpers shared by the student API routes and the admin routes.
import { db } from "./supabase.js";
import { GRACE_SECONDS, gradeAnswers } from "./logic.js";

// The quiz students can currently take (the newest "published" one).
export async function getActiveQuiz() {
  const { data, error } = await db()
    .from("quizzes")
    .select("id, title, duration_minutes")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAttemptByToken(token) {
  const { data, error } = await db().from("attempts").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  return data;
}

// Grades an attempt and saves the result PERMANENTLY.
// The UPDATE only matches rows that are still "in_progress", so even if two
// requests arrive at the same moment (double click, refresh, timer + button),
// only ONE of them can finalise the attempt. The other just gets the saved result.
export async function finalizeAttempt(attempt, { answers, submitType, submittedAt }) {
  const ids = attempt.question_order.map((o) => o.id);
  const { data: rows, error } = await db().from("questions").select("id, correct_index").in("id", ids);
  if (error) throw error;

  const correctById = Object.fromEntries(rows.map((r) => [r.id, r.correct_index]));
  const { score, total } = gradeAnswers(attempt.question_order, answers, correctById);

  const startedMs = new Date(attempt.started_at).getTime();
  const endMs = Math.min(submittedAt.getTime(), new Date(attempt.expires_at).getTime());
  const timeTaken = Math.max(0, Math.round((endMs - startedMs) / 1000));

  const { data: updated, error: updateError } = await db()
    .from("attempts")
    .update({
      status: "submitted",
      answers,
      score,
      total,
      submit_type: submitType,
      submitted_at: submittedAt.toISOString(),
      time_taken_seconds: timeTaken,
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress")
    .select()
    .maybeSingle();
  if (updateError) throw updateError;
  if (updated) return updated;

  // Someone else finalised it first - return the stored result.
  const { data: existing, error: readError } = await db()
    .from("attempts")
    .select("*")
    .eq("id", attempt.id)
    .single();
  if (readError) throw readError;
  return existing;
}

// Students who closed the tab without submitting still get a score:
// once their time (plus grace) has passed, we grade whatever answers were saved.
export async function finalizeExpired(quizId) {
  const cutoff = new Date(Date.now() - GRACE_SECONDS * 1000).toISOString();
  let query = db().from("attempts").select("*").eq("status", "in_progress").lt("expires_at", cutoff);
  if (quizId) query = query.eq("quiz_id", quizId);
  const { data, error } = await query;
  if (error) throw error;

  for (const attempt of data) {
    await finalizeAttempt(attempt, {
      answers: attempt.answers,
      submitType: "expired",
      submittedAt: new Date(attempt.expires_at),
    });
  }
}

// What the student is shown after submitting.
export function resultPayload(attempt, quizTitle) {
  return {
    status: "submitted",
    username: attempt.username,
    quizTitle,
    score: attempt.score,
    total: attempt.total,
    timeTakenSeconds: attempt.time_taken_seconds,
    submittedAt: attempt.submitted_at,
    submitType: attempt.submit_type,
  };
}

export async function getQuizTitle(quizId) {
  const { data, error } = await db().from("quizzes").select("title").eq("id", quizId).maybeSingle();
  if (error) throw error;
  return data?.title ?? "Quiz";
}

