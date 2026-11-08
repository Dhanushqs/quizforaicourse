import { db } from "@/lib/supabase";
import { HttpError, json, readJson, withErrors } from "@/lib/http";
import { isUuid } from "@/lib/logic";

// POST /api/quiz/answer  { token, questionId, choice }
// Auto-saves ONE answer as the student clicks, so a refresh never loses progress.
// The database function refuses the save if the attempt is submitted or time is up.
export const POST = withErrors(async (request) => {
  const { token, questionId, choice } = await readJson(request);

  if (!isUuid(token) || !isUuid(questionId) || !Number.isInteger(choice) || choice < 0 || choice > 3) {
    throw new HttpError(400, "Invalid request.");
  }

  const { data, error } = await db().rpc("save_answer", {
    p_token: token,
    p_question: questionId,
    p_choice: choice,
  });
  if (error) throw error;

  if (!data) throw new HttpError(409, "This answer could not be saved: the quiz is finished or time is up.");
  return json({ ok: true });
});
