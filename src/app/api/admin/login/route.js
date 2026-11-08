import { newAuthClient } from "@/lib/supabase";
import { checkAdminPassword, isAdminEmail, setAdminSession, setPasswordSession } from "@/lib/auth";
import { HttpError, json, readJson, withErrors } from "@/lib/http";

// POST /api/admin/login  { email (optional), password }
//  1) If the password equals the ADMIN_PASSWORD variable -> logged in (email not needed).
//  2) Otherwise, if an email is given -> normal Supabase email + password login.
export const POST = withErrors(async (request) => {
  const { email, password } = await readJson(request);
  const invalid = new HttpError(401, "Wrong email or password.");

  if (typeof password !== "string" || !password) throw invalid;

  if (checkAdminPassword(password)) {
    await setPasswordSession();
    return json({ ok: true });
  }

  if (typeof email !== "string" || !email.trim()) throw invalid;
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
