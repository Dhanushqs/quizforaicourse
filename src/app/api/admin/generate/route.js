import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, withErrors } from "@/lib/http";
import { extractText } from "@/lib/extract";
import { generateQuestions } from "@/lib/ai";

// Allow up to 60 seconds: asking the AI for 15 questions can take a while.
export const maxDuration = 60;

// POST /api/admin/generate  (multipart form: title, duration, file OR text)
// Reads the study material, asks the AI for 15 MCQs and saves them as a DRAFT quiz.
export const POST = withErrors(async (request) => {
  await requireAdmin();

  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 120) || "Untitled quiz";
  const duration = Math.min(300, Math.max(1, Math.round(Number(form.get("duration")) || 20)));

  const file = form.get("file");
  let text = String(form.get("text") || "");
  if (file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size > 0) {
    text = await extractText(file);
  }

  if (text.trim().length < 200) {
    throw new HttpError(
      400,
      "I could not find enough text. If your PDF is a scan (pictures of pages), copy the text and paste it into the text box instead."
    );
  }

  const questions = await generateQuestions(text);

  const { data: quiz, error } = await db()
    .from("quizzes")
    .insert({ title, duration_minutes: duration, status: "draft" })
    .select("id")
    .single();
  if (error) throw error;

  const { error: qError } = await db()
    .from("questions")
    .insert(questions.map((q, i) => ({ ...q, quiz_id: quiz.id, position: i })));
  if (qError) {
    await db().from("quizzes").delete().eq("id", quiz.id); // don't leave an empty quiz behind
    throw qError;
  }

  return json({ quizId: quiz.id });
});
