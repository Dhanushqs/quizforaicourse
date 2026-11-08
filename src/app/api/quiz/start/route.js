import { db } from "@/lib/supabase";
import { HttpError, json, readJson, withErrors } from "@/lib/http";
import { getActiveQuiz } from "@/lib/quiz";
import { buildOrder, cleanUsername, usernameKey } from "@/lib/logic";

// POST /api/quiz/start  { username }
// Creates this student's unique attempt (random order, server-side deadline).
export const POST = withErrors(async (request) => {
  const body = await readJson(request);

  const username = cleanUsername(body.username);
  if (!username) {
    throw new HttpError(
      400,
      "Please enter a valid username: 2-30 characters using letters, numbers, spaces, dots, dashes or underscores."
    );
  }

  const quiz = await getActiveQuiz();
  if (!quiz) throw new HttpError(409, "No quiz is open right now. Please wait for your teacher.");

  const { data: questions, error: qError } = await db().from("questions").select("id").eq("quiz_id", quiz.id);
  if (qError) throw qError;
  if (!questions.length) throw new HttpError(409, "This quiz has no questions yet.");

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + quiz.duration_minutes * 60 * 1000);

  const { data: attempt, error } = await db()
    .from("attempts")
    .insert({
      quiz_id: quiz.id,
      username,
      username_key: usernameKey(username),
      question_order: buildOrder(questions.map((q) => q.id)),
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("token")
    .single();

  if (error) {
    // 23505 = "unique violation": this username already has an attempt for this quiz.
    if (error.code === "23505") {
      throw new HttpError(
        409,
        "This username has already been used for this quiz. If it is yours and you lost your session, ask your teacher to reset it."
      );
    }
    throw error;
  }

  return json({ token: attempt.token });
});
