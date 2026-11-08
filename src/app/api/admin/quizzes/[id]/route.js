import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, readJson, withErrors } from "@/lib/http";
import { isUuid, validateQuestion } from "@/lib/logic";

export const dynamic = "force-dynamic";

async function loadQuiz(id) {
  if (!isUuid(id)) throw new HttpError(404, "Quiz not found.");
  const { data, error } = await db().from("quizzes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Quiz not found.");
  return data;
}

async function countAttempts(id) {
  const { count, error } = await db()
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", id);
  if (error) throw error;
  return count ?? 0;
}

// GET -> the quiz with ALL its questions INCLUDING correct answers (admin only!)
export const GET = withErrors(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const quiz = await loadQuiz(id);

  const { data: questions, error } = await db()
    .from("questions")
    .select("id, question, options, correct_index")
    .eq("quiz_id", id)
    .order("position", { ascending: true });
  if (error) throw error;

  return json({ quiz, questions, attemptCount: await countAttempts(id) });
});

// PUT -> save title / duration / questions / status
export const PUT = withErrors(async (request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await loadQuiz(id);
  const body = await readJson(request);
  const updates = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120);
    if (!title) throw new HttpError(400, "The quiz title cannot be empty.");
    updates.title = title;
  }

  if (body.duration_minutes !== undefined) {
    const minutes = Number(body.duration_minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) {
      throw new HttpError(400, "Duration must be a whole number of minutes between 1 and 300.");
    }
    updates.duration_minutes = minutes;
  }

  if (body.questions !== undefined) {
    if (!Array.isArray(body.questions) || body.questions.length > 100) {
      throw new HttpError(400, "Invalid questions.");
    }
    if ((await countAttempts(id)) > 0) {
      throw new HttpError(
        409,
        "Questions are locked because students have already started this quiz. Delete the attempts (on the Results tab) if they were only tests."
      );
    }

    const cleaned = body.questions.map((q, i) => ({
      id: isUuid(q?.id) ? q.id : null,
      position: i,
      ...validateQuestion(q, i),
    }));

    const { data: existing, error } = await db().from("questions").select("id").eq("quiz_id", id);
    if (error) throw error;
    const existingIds = new Set(existing.map((r) => r.id));
    const keepIds = new Set(cleaned.filter((q) => q.id && existingIds.has(q.id)).map((q) => q.id));

    // 1) delete questions the admin removed
    const removeIds = [...existingIds].filter((qid) => !keepIds.has(qid));
    if (removeIds.length) {
      const { error: delError } = await db().from("questions").delete().in("id", removeIds);
      if (delError) throw delError;
    }
    // 2) update the ones that still exist
    const toUpdate = cleaned.filter((q) => q.id && keepIds.has(q.id)).map((q) => ({ ...q, quiz_id: id }));
    if (toUpdate.length) {
      const { error: upError } = await db().from("questions").upsert(toUpdate, { onConflict: "id" });
      if (upError) throw upError;
    }
    // 3) insert the new ones
    const toInsert = cleaned
      .filter((q) => !(q.id && keepIds.has(q.id)))
      .map(({ id: _ignored, ...rest }) => ({ ...rest, quiz_id: id }));
    if (toInsert.length) {
      const { error: insError } = await db().from("questions").insert(toInsert);
      if (insError) throw insError;
    }
  }

  if (body.status !== undefined) {
    if (!["draft", "published", "closed"].includes(body.status)) {
      throw new HttpError(400, "Invalid status.");
    }
    if (body.status === "published") {
      const { count, error } = await db()
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", id);
      if (error) throw error;
      if (!count) throw new HttpError(400, "Add at least one question before publishing.");

      // Only one quiz can be open at a time: close any other published quiz.
      const { error: closeError } = await db()
        .from("quizzes")
        .update({ status: "closed" })
        .eq("status", "published")
        .neq("id", id);
      if (closeError) throw closeError;
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length) {
    const { error } = await db().from("quizzes").update(updates).eq("id", id);
    if (error) throw error;
  }

  return json({ ok: true });
});

// DELETE -> remove the quiz, its questions and all attempts
export const DELETE = withErrors(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await loadQuiz(id);
  const { error } = await db().from("quizzes").delete().eq("id", id);
  if (error) throw error;
  return json({ ok: true });
});
