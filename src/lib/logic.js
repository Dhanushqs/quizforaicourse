// Pure helper functions (no database, no network) - easy to test.
import { randomInt } from "node:crypto";
import { HttpError } from "./errors.js";

// Students may still submit up to this many seconds after the deadline
// (to allow for slow networks). After that, only already-saved answers count.
export const GRACE_SECONDS = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

const validChoice = (v) => Number.isInteger(v) && v >= 0 && v <= 3;

// Fisher-Yates shuffle using a cryptographically secure random generator.
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns a cleaned username, or null if it is not acceptable.
export function cleanUsername(raw) {
  const name = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 30) return null;
  // \p{L} letters, \p{M} combining marks (needed for Hindi, Tamil, Kannada... vowel signs), \p{N} digits
  if (!/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(name)) return null;
  return name;
}

export const usernameKey = (name) => name.toLowerCase();

// Creates one student's random layout:
// [{ id: <question id>, order: [2,0,3,1] }, ...]
// - the list order is the order of questions
// - "order" says which ORIGINAL option goes in position 1, 2, 3, 4
export function buildOrder(questionIds) {
  return shuffle(questionIds).map((id) => ({ id, order: shuffle([0, 1, 2, 3]) }));
}

// Builds what the student is allowed to see. Note: NO correct answers here.
export function toStudentQuestions(order, questionsById) {
  return order.map(({ id, order: perm }) => {
    const q = questionsById[id];
    return { id, text: q.question, options: perm.map((i) => q.options[i]) };
  });
}

// answers = { questionId: positionTheStudentClicked (0-3) }
// The position is translated back to the original option before comparing.
export function gradeAnswers(order, answers, correctById) {
  let score = 0;
  for (const item of order) {
    const shown = answers?.[item.id];
    if (validChoice(shown) && item.order[shown] === correctById[item.id]) score += 1;
  }
  return { score, total: order.length };
}

// Combine already-saved answers with the answers sent at submit time.
// Only answers for this attempt's own questions with valid values are kept.
export function mergeAnswers(stored, incoming, order) {
  const merged = {};
  for (const { id } of order) {
    const fromClient = incoming?.[id];
    const fromDb = stored?.[id];
    if (validChoice(fromClient)) merged[id] = fromClient;
    else if (validChoice(fromDb)) merged[id] = fromDb;
  }
  return merged;
}

// Checks and cleans one question coming from the admin screen.
export function validateQuestion(q, index) {
  const label = `Question ${index + 1}`;
  const question = String(q?.question ?? "").trim();
  const options = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? "").trim()) : [];

  if (!question) throw new HttpError(400, `${label}: the question text is empty.`);
  if (question.length > 1000) throw new HttpError(400, `${label}: the question is too long.`);
  if (options.length !== 4 || options.some((o) => !o)) {
    throw new HttpError(400, `${label}: it needs exactly 4 non-empty options.`);
  }
  if (options.some((o) => o.length > 500)) {
    throw new HttpError(400, `${label}: an option is too long.`);
  }
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) {
    throw new HttpError(400, `${label}: the 4 options must all be different.`);
  }
  if (!validChoice(q?.correct_index)) {
    throw new HttpError(400, `${label}: choose which option is correct.`);
  }
  return { question, options, correct_index: q.correct_index };
}
