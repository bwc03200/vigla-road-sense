import { useEffect } from "react";
import { toast } from "sonner";
import i18n from "@/i18n/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useVigla } from "@/lib/vigla-store";
import type { EmergencyContact } from "@/types/vigla";

const t = (k: string) => i18n.t(k);

// Types file is regenerated after migrations; cast until then.
type AnyClient = { from: (t: string) => any };
const db = supabase as unknown as AnyClient;

export function useEmergencyContacts(userId: string | null) {
  const setEmergencyContacts = useVigla((s) => s.setEmergencyContacts);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    db.from("emergency_contacts")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }: { data: EmergencyContact[] | null; error: unknown }) => {
        if (cancelled) return;
        if (!error && data) setEmergencyContacts(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, setEmergencyContacts]);

  async function add(input: { name: string; phone?: string; email?: string }) {
    if (!userId) return;
    const { data, error } = await db
      .from("emergency_contacts")
      .insert({
        user_id: userId,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(t("contacts.addFailed"));
      return;
    }
    const current = useVigla.getState().emergencyContacts;
    if (data) useVigla.getState().setEmergencyContacts([...current, data as EmergencyContact]);
  }

  async function remove(id: string) {
    const { error } = await db.from("emergency_contacts").delete().eq("id", id);
    if (error) {
      toast.error(t("contacts.deleteFailed"));
      return;
    }
    const current = useVigla.getState().emergencyContacts;
    useVigla.getState().setEmergencyContacts(current.filter((c) => c.id !== id));
  }

  return { add, remove };
}
