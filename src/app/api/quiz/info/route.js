import { db } from "@/lib/supabase";
import { json, withErrors } from "@/lib/http";
import { getActiveQuiz } from "@/lib/quiz";

export const dynamic = "force-dynamic";

// GET /api/quiz/info -> which quiz is open right now? (shown on the home page)
export const GET = withErrors(async () => {
  const quiz = await getActiveQuiz();
  if (!quiz) return json({ quiz: null });

  const { count, error } = await db()
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quiz.id);
  if (error) throw error;

  return json({ quiz: { ...quiz, question_count: count ?? 0 } });
});
