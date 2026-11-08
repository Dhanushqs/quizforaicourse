import { NextResponse } from "next/server";
import { HttpError } from "./errors.js";

export { HttpError };

// Send JSON back to the browser. "no-store" stops the browser caching it.
export function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Read the JSON body of a request (or fail with a clean 400 error).
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}

// Wrap every API handler so that errors become tidy JSON responses
// instead of crashing. Unexpected errors are logged on the server only.
export function withErrors(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, err.status);
      }
      console.error(err);
      return json({ error: "Something went wrong on the server. Please try again." }, 500);
    }
  };
}
