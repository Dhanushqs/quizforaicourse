import { cookies } from "next/headers";
import { db, newAuthClient } from "./supabase.js";
import { HttpError } from "./errors.js";

const ACCESS_COOKIE = "admin_at";
const REFRESH_COOKIE = "admin_rt";
const WEEK = 60 * 60 * 24 * 7;

// Only emails listed in ADMIN_EMAILS may use the admin area,
// even if someone manages to create a Supabase account.
export function isAdminEmail(email) {
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email) && allowed.includes(String(email).toLowerCase());
}

const cookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read these cookies
  sameSite: "lax", // not sent on cross-site POST requests (CSRF protection)
  secure: process.env.NODE_ENV === "production", // HTTPS only on Vercel
  path: "/",
  maxAge: WEEK,
};

export async function setAdminSession(session) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.access_token, cookieOptions);
  jar.set(REFRESH_COOKIE, session.refresh_token, cookieOptions);
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

// Returns the logged-in admin user, or null.
export async function getAdmin() {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const { data, error } = await db().auth.getUser(accessToken);
    if (!error && data?.user && isAdminEmail(data.user.email)) return data.user;
  }

  // Access tokens expire after about an hour: quietly get a new one.
  if (refreshToken) {
    const { data, error } = await newAuthClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!error && data?.session && data.user && isAdminEmail(data.user.email)) {
      try {
        await setAdminSession(data.session);
      } catch {
        /* cookies can't be written in some contexts; the login still works */
      }
      return data.user;
    }
  }
  return null;
}

// Call this at the top of EVERY admin API route.
export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) throw new HttpError(401, "Please log in as admin.");
  return user;
}
