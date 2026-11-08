import { db } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, withErrors } from "@/lib/http";
import { isUuid } from "@/lib/logic";

// DELETE /api/admin/attempts/<id>  -> reset ONE student so they can start again
export const DELETE = withErrors(async (_request, { params }) => {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) throw new HttpError(404, "Attempt not found.");

  const { error } = await db().from("attempts").delete().eq("id", id);
  if (error) throw error;
  return json({ ok: true });
});
