import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, newAuthClient } from "./supabase.js";
import { HttpError } from "./errors.js";

const ACCESS_COOKIE = "admin_at";
const REFRESH_COOKIE = "admin_rt";
const PASSWORD_COOKIE = "admin_pw";
const WEEK = 60 * 60 * 24 * 7;

// Only emails listed in ADMIN_EMAILS may use the admin area through Supabase login,
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

// ---------- Option 2: one admin password stored in the ADMIN_PASSWORD variable ----------

const sha = (text) => createHash("sha256").update(String(text)).digest();

export function passwordLoginEnabled() {
  return (process.env.ADMIN_PASSWORD || "").length >= 8;
}

// Constant-time comparison, so response timing reveals nothing about the password.
export function checkAdminPassword(candidate) {
  if (!passwordLoginEnabled() || typeof candidate !== "string") return false;
  return timingSafeEqual(sha(candidate), sha(process.env.ADMIN_PASSWORD));
}

function sign(value) {
  const secret = `${process.env.ADMIN_PASSWORD || ""}|${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`;
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function setPasswordSession() {
  const expires = String(Date.now() + WEEK * 1000);
  const jar = await cookies();
  jar.set(PASSWORD_COOKIE, `${expires}.${sign(expires)}`, cookieOptions);
}

async function hasPasswordSession() {
  if (!passwordLoginEnabled()) return false;
  const jar = await cookies();
  const raw = jar.get(PASSWORD_COOKIE)?.value;
  if (!raw) return false;
  const [expires, signature] = raw.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return timingSafeEqual(sha(signature), sha(sign(expires)));
}

// ---------- Option 1: Supabase email + password ----------

export async function setAdminSession(session) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, session.access_token, cookieOptions);
  jar.set(REFRESH_COOKIE, session.refresh_token, cookieOptions);
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(PASSWORD_COOKIE);
}

// Returns the logged-in admin, or null.
export async function getAdmin() {
  if (await hasPasswordSession()) return { email: "Admin" };

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
