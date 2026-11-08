import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, withErrors } from "@/lib/http";
import { finalizeExpired } from "@/lib/quiz";
import { isUuid } from "@/lib/logic";

export const dynamic = "force-dynamic";

function getQuizId(request) {
  const quizId = new URL(request.url).searchParams.get("quizId");
  if (!isUuid(quizId)) throw new HttpError(400, "quizId is required.");
  return quizId;
}

// GET /api/admin/results?quizId=...  -> every student's attempt for that quiz
export const GET = withErrors(async (request) => {
  await requireAdmin();
  const quizId = getQuizId(request);

  await finalizeExpired(quizId); // grade students who never pressed submit

  const { data, error } = await db()
    .from("attempts")
    .select("id, username, status, submit_type, score, total, time_taken_seconds, started_at, submitted_at")
    .eq("quiz_id", quizId)
    .order("started_at", { ascending: true });
  if (error) throw error;

  return json({ attempts: data });
});

// DELETE /api/admin/results?quizId=...  -> delete ALL attempts (e.g. after test runs)
export const DELETE = withErrors(async (request) => {
  await requireAdmin();
  const quizId = getQuizId(request);
  const { error } = await db().from("attempts").delete().eq("quiz_id", quizId);
  if (error) throw error;
  return json({ ok: true });
});
