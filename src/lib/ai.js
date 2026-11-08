import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "./errors.js";
import { validateQuestion } from "./logic.js";

export const QUESTION_COUNT = 15;
const MAX_CHARS = 80000; // ~20k tokens of study material is plenty for 15 questions

// We ask the AI to "call a tool" with a fixed shape. This forces it to return
// clean structured data instead of free text we would have to parse.
const saveQuestionsTool = {
  name: "save_questions",
  description: "Save the generated multiple-choice questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correct_index: {
              type: "integer",
              minimum: 0,
              maximum: 3,
              description: "Index (0-3) of the correct option in the options array",
            },
          },
          required: ["question", "options", "correct_index"],
        },
      },
    },
    required: ["questions"],
  },
};

function buildPrompt(text) {
  return `You are an experienced teacher writing a multiple-choice quiz.

Using ONLY the study material below, write exactly ${QUESTION_COUNT} multiple-choice questions.

Rules:
- Each question has exactly 4 options and exactly ONE correct answer.
- Wrong options must be plausible, but clearly wrong according to the material.
- Test understanding of the important ideas, not trivia such as page numbers or formatting.
- Mix easy, medium and harder questions. Do not repeat the same question.
- Never say "according to the text/passage/material". Every question must make sense on its own.
- Keep options short. No "A)" or "1." prefixes. Do not use "All of the above" or "None of the above".
- Spread the correct answer across different positions.

<study_material>
${text}
</study_material>

Call the save_questions tool with the ${QUESTION_COUNT} questions.`;
}

async function askOnce(client, text) {
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 8000,
    tools: [saveQuestionsTool],
    tool_choice: { type: "tool", name: "save_questions" },
    messages: [{ role: "user", content: buildPrompt(text) }],
  });

  const block = message.content.find((b) => b.type === "tool_use");
  const raw = Array.isArray(block?.input?.questions) ? block.input.questions : [];

  // Keep only the questions that pass our own strict checks.
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(500, "ANTHROPIC_API_KEY is not set on the server.");
  }

  const text = studyText.replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const started = Date.now();

  let best = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      best = await askOnce(client, text);
    } catch (err) {
      console.error("AI request failed:", err);
      throw new HttpError(502, "The AI service returned an error. Check your API key/credits and try again.");
    }
    if (best.length >= QUESTION_COUNT) return best.slice(0, QUESTION_COUNT);
    // Only retry if there is still time left inside the serverless time limit.
    if (Date.now() - started > 25000) break;
  }

  throw new HttpError(
    502,
    `The AI produced only ${best.length} valid questions. Please try again (a longer or clearer document helps).`
  );
}
