import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Best-effort cleanup of user-owned rows (some tables cascade via FK).
    const tables = [
      "user_preferences",
      "emergency_contacts",
      "roadbooks",
      "trip_history",
      "convoy_members",
    ] as const;
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<unknown> } };
    };
    for (const t of tables) {
      await admin.from(t).delete().eq("user_id", userId);
    }


    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
