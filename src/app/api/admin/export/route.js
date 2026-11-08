import * as XLSX from "xlsx";
import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { HttpError, withErrors } from "@/lib/http";
import { finalizeExpired } from "@/lib/quiz";
import { isUuid } from "@/lib/logic";
import { toCsv } from "@/lib/csv";
import { formatDateTime, formatDuration } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADERS = [
  "Username",
  "Score",
  "Total marks",
  "Percentage",
  "Submitted at (IST)",
  "Time taken",
  "Time taken (seconds)",
  "Status",
  "How it ended",
];

const HOW = { manual: "Submitted by student", timeout: "Auto-submitted (timer)", expired: "Time ran out (not submitted)" };

// GET /api/admin/export?quizId=...&format=csv|xlsx
export const GET = withErrors(async (request) => {
  await requireAdmin();

  const params = new URL(request.url).searchParams;
  const quizId = params.get("quizId");
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  if (!isUuid(quizId)) throw new HttpError(400, "quizId is required.");

  await finalizeExpired(quizId);

  const { data: quiz, error: quizError } = await db().from("quizzes").select("title").eq("id", quizId).maybeSingle();
  if (quizError) throw quizError;
  if (!quiz) throw new HttpError(404, "Quiz not found.");

  const { data: attempts, error } = await db()
    .from("attempts")
    .select("username, status, submit_type, score, total, time_taken_seconds, submitted_at")
    .eq("quiz_id", quizId)
    .order("username", { ascending: true });
  if (error) throw error;

  const rows = attempts.map((a) => [
    a.username,
    a.score ?? "",
    a.total ?? "",
    a.total ? Math.round((a.score / a.total) * 1000) / 10 : "",
    formatDateTime(a.submitted_at),
    formatDuration(a.time_taken_seconds),
    a.time_taken_seconds ?? "",
    a.status === "submitted" ? "Submitted" : "In progress",
    HOW[a.submit_type] ?? "",
  ]);

  const safeTitle = quiz.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "quiz";
  const filename = `${safeTitle}_results.${format}`;

  if (format === "csv") {
    return new Response(toCsv(HEADERS, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  sheet["!cols"] = [22, 8, 12, 12, 24, 12, 20, 12, 28].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Results");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
