import { clearAdminSession } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// POST /api/admin/logout
export const POST = withErrors(async () => {
  await clearAdminSession();
  return json({ ok: true });
});
