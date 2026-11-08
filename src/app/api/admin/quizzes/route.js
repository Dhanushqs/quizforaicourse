import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/admin/quizzes -> list of all quizzes with question and attempt counts
export const GET = withErrors(async () => {
  await requireAdmin();

  const [quizzes, questions, attempts] = await Promise.all([
    db().from("quizzes").select("*").order("created_at", { ascending: false }),
    db().from("questions").select("quiz_id"),
    db().from("attempts").select("quiz_id, status"),
  ]);
  for (const r of [quizzes, questions, attempts]) if (r.error) throw r.error;

  const count = (rows, id, status) =>
    rows.filter((r) => r.quiz_id === id && (!status || r.status === status)).length;

  return json({
    quizzes: quizzes.data.map((q) => ({
      ...q,
      question_count: count(questions.data, q.id),
      attempt_count: count(attempts.data, q.id),
      submitted_count: count(attempts.data, q.id, "submitted"),
    })),
  });
});
