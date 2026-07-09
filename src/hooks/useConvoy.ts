import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { Convoy, ConvoyAlert, ConvoyMember } from "@/types/vigla";

type AnyClient = { from: (t: string) => any };
const db = supabase as unknown as AnyClient;

function randomCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Convoy lifecycle: create / join / leave, plus realtime subscriptions. */
export function useConvoy(userId: string | null) {
  const convoy = useVigla((s) => s.convoy);
  const position = useVigla((s) => s.position);
  const displayName = useVigla((s) => s.displayName);
  const setConvoy = useVigla((s) => s.setConvoy);
  const setConvoyMembers = useVigla((s) => s.setConvoyMembers);
  const pushConvoyAlert = useVigla((s) => s.pushConvoyAlert);
  const setConvoyAlerts = useVigla((s) => s.setConvoyAlerts);

  const lastPushAt = useRef(0);

  // Realtime members + alerts subscription.
  useEffect(() => {
    if (!convoy) return;
    let mounted = true;

    async function loadInitial() {
      const [{ data: members }, { data: alerts }] = await Promise.all([
        db.from("convoy_members").select("*").eq("convoy_id", convoy!.id),
        db
          .from("convoy_alerts")
          .select("*")
          .eq("convoy_id", convoy!.id)
          .gt("expires_at", new Date().toISOString()),
      ]);
      if (!mounted) return;
      if (members) setConvoyMembers(members as ConvoyMember[]);
      if (alerts) setConvoyAlerts(alerts as ConvoyAlert[]);
    }
    loadInitial();

    const channel = supabase
      .channel(`convoy:${convoy.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "convoy_members", filter: `convoy_id=eq.${convoy.id}` },
        async () => {
          const { data } = await db
            .from("convoy_members")
            .select("*")
            .eq("convoy_id", convoy.id);
          if (data) setConvoyMembers(data as ConvoyMember[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "convoy_alerts", filter: `convoy_id=eq.${convoy.id}` },
        (payload) => {
          pushConvoyAlert(payload.new as ConvoyAlert);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [convoy, setConvoyMembers, setConvoyAlerts, pushConvoyAlert]);

  // Auto-expire alerts by time.
  useEffect(() => {
    if (!convoy) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const alerts = useVigla.getState().convoyAlerts;
      const fresh = alerts.filter((a) => new Date(a.expires_at).getTime() > now);
      if (fresh.length !== alerts.length) setConvoyAlerts(fresh);
    }, 3000);
    return () => window.clearInterval(id);
  }, [convoy, setConvoyAlerts]);

  // Push own position every 5s.
  useEffect(() => {
    if (!convoy || !userId || !position) return;
    const now = Date.now();
    if (now - lastPushAt.current < 5000) return;
    lastPushAt.current = now;
    db.from("convoy_members")
      .update({
        last_lat: position.lat,
        last_lng: position.lng,
        last_seen: new Date().toISOString(),
      })
      .eq("convoy_id", convoy.id)
      .eq("user_id", userId)
      .then(() => {});
  }, [position, convoy, userId]);

  async function createConvoy(name: string) {
    if (!userId) return;
    const code = randomCode();
    const { data, error } = await db
      .from("convoys")
      .insert({ name, code, owner_id: userId })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Création du convoi impossible");
      return;
    }
    const c = data as Convoy;
    await db.from("convoy_members").insert({
      convoy_id: c.id,
      user_id: userId,
      display_name: displayName || "Moi",
    });
    setConvoy(c);
    toast.success(`Convoi créé — code ${c.code}`);
  }

  async function joinConvoy(code: string) {
    if (!userId) return;
    const { data: convoyRow, error } = await db
      .from("convoys")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (error || !convoyRow) {
      toast.error("Code de convoi introuvable");
      return;
    }
    const c = convoyRow as Convoy;
    await db.from("convoy_members").upsert(
      {
        convoy_id: c.id,
        user_id: userId,
        display_name: displayName || "Moi",
        last_seen: new Date().toISOString(),
      },
      { onConflict: "convoy_id,user_id" },
    );
    setConvoy(c);
    toast.success(`Convoi rejoint : ${c.name}`);
  }

  async function leaveConvoy() {
    if (!convoy || !userId) return;
    await db
      .from("convoy_members")
      .delete()
      .eq("convoy_id", convoy.id)
      .eq("user_id", userId);
    setConvoy(null);
    toast("Convoi quitté");
  }

  return { createConvoy, joinConvoy, leaveConvoy };
}
