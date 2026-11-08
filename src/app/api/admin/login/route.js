import { newAuthClient } from "@/lib/supabase";
import { isAdminEmail, setAdminSession } from "@/lib/auth";
import { HttpError, json, readJson, withErrors } from "@/lib/http";

// POST /api/admin/login  { email, password }
export const POST = withErrors(async (request) => {
  const { email, password } = await readJson(request);
  const invalid = new HttpError(401, "Wrong email or password.");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) throw invalid;
  // Not on the admin list? Same error message, so nobody can probe which emails exist.
  if (!isAdminEmail(email)) throw invalid;

  const { data, error } = await newAuthClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data?.session) throw invalid;

  await setAdminSession(data.session);
  return json({ ok: true });
});
