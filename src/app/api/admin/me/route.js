import { requireAdmin } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/admin/me -> who is logged in? (401 if nobody)
export const GET = withErrors(async () => {
  const user = await requireAdmin();
  return json({ email: user.email });
});
