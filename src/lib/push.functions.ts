import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendConvoyPushSchema = z.object({
  convoyId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
  url: z.string().optional(),
});

export const sendConvoyPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendConvoyPushSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { convoyId, title, body, url } = data;
    const senderId = context.userId;

    // Verify caller is a member of the convoy (RLS-scoped read).
    const { data: myMembership, error: memberErr } = await context.supabase
      .from("convoy_members")
      .select("user_id")
      .eq("convoy_id", convoyId)
      .eq("user_id", senderId)
      .maybeSingle();
    if (memberErr || !myMembership) {
      return { ok: false, reason: "not-a-member", sent: 0 };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };

    // Get all other members of this convoy.
    const { data: members } = await admin
      .from("convoy_members")
      .select("user_id")
      .eq("convoy_id", convoyId);
    const recipientIds = (members ?? [])
      .map((m: { user_id: string }) => m.user_id)
      .filter((id: string) => id !== senderId);
    if (recipientIds.length === 0) return { ok: true, sent: 0 };

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .in("user_id", recipientIds);
    if (!subs || subs.length === 0) return { ok: true, sent: 0 };

    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@vigla.app",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/?tab=convoy",
      convoyId,
      tag: `convoy-${convoyId}`,
    });

    let sent = 0;
    const staleIds: string[] = [];
    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; keys: { p256dh: string; auth: string } }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            payload,
            { TTL: 60 },
          );
          sent++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(s.id);
          } else {
            console.error("[send-push] failed:", err);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", staleIds);
    }

    return { ok: true, sent };
  });
