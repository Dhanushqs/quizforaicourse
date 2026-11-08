import { HttpError } from "./errors.js";
import { validateQuestion } from "./logic.js";

export const QUESTION_COUNT = 15;

// Groq's free plan allows roughly 12,000 tokens per minute for this model,
// so we only send the first ~24,000 characters (about 6,000 tokens) of the material.
const MAX_CHARS = 24000;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt(text) {
  return `Using ONLY the study material below, write exactly ${QUESTION_COUNT} multiple-choice questions.

Rules:
- Each question has exactly 4 options and exactly ONE correct answer.
- Wrong options must be plausible, but clearly wrong according to the material.
- Test understanding of the important ideas, not trivia such as page numbers or formatting.
- Mix easy, medium and harder questions. Do not repeat the same question.
- Never say "according to the text/passage/material". Every question must make sense on its own.
- Keep options short. No "A)" or "1." prefixes. Do not use "All of the above" or "None of the above".
- Spread the correct answer across different positions.
- "correct_index" is the position (0, 1, 2 or 3) of the correct option inside "options".

Reply with JSON only, in exactly this shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"correct_index":0}]}

<study_material>
${text}
</study_material>`;
}

// Sends one request to Groq and returns the questions that pass our own strict checks.
async function askOnce(text, apiKey) {
  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 6000,
        response_format: { type: "json_object" }, // forces valid JSON back
        messages: [
          { role: "system", content: "You are an experienced teacher who writes accurate multiple-choice quizzes. You reply with JSON only." },
          { role: "user", content: buildPrompt(text) },
        ],
      }),
      signal: AbortSignal.timeout(40000),
    });
  } catch (err) {
    console.error("AI request failed (network/timeout):", err);
    throw new HttpError(502, "Could not reach the AI service (timeout). Please try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("AI request failed:", res.status, body.slice(0, 600));
    if (res.status === 401) throw new HttpError(502, "The Groq API key was rejected. Check GROQ_API_KEY in Vercel and redeploy.");
    if (res.status === 429) throw new HttpError(502, "Groq rate limit reached. Wait one minute and try again.");
    if (res.status === 413) throw new HttpError(502, "The study material is too large for Groq's limits. Use a shorter file or paste fewer pages.");
    if (res.status === 400 || res.status === 404) {
      throw new HttpError(502, "Groq rejected the request (the model name may be wrong). Check the Vercel logs.");
    }
    throw new HttpError(502, "The AI service returned an error. Please try again.");
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content ?? "";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("AI returned invalid JSON:", content.slice(0, 300));
    return [];
  }

  const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const good = [];
  raw.forEach((q, i) => {
    try {
      good.push(validateQuestion(q, i));
    } catch {
      /* skip a malformed question */
    }
  });
  return good;
}

export async function generateQuestions(studyText) {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) throw new HttpError(500, "GROQ_API_KEY is not set on the server.");

  const text = studyText.replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
  const started = Date.now();

  let best = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    best = await askOnce(text, apiKey);
    if (best.length >= QUESTION_COUNT) return best.slice(0, QUESTION_COUNT);
    // Only retry if there is still time left inside the serverless time limit.
    if (Date.now() - started > 25000) break;
  }

  throw new HttpError(
    502,
    `The AI produced only ${best.length} valid questions. Please try again (a longer or clearer document helps).`
  );
}
