import { useState } from "react";
import { Plus, Trash2, Phone, Mail, ShieldAlert, Vibrate } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVigla } from "@/lib/vigla-store";
import { useEmergencyContacts } from "@/hooks/useEmergencyContacts";

export function EmergencyContactsScreen({ userId }: { userId: string }) {
  const contacts = useVigla((s) => s.emergencyContacts);
  const crashEnabled = useVigla((s) => s.crashDetectionEnabled);
  const setCrashEnabled = useVigla((s) => s.setCrashDetectionEnabled);
  const vibrationEnabled = useVigla((s) => s.vibrationEnabled);
  const setVibrationEnabled = useVigla((s) => s.setVibrationEnabled);
  const displayName = useVigla((s) => s.displayName);
  const setDisplayName = useVigla((s) => s.setDisplayName);
  const { add, remove } = useEmergencyContacts(userId);


  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function submit() {
    if (!name.trim()) return;
    await add({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    setName("");
    setPhone("");
    setEmail("");
  }

  return (
    <div className="space-y-6 p-4 pb-8">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
          Pseudo (convoi)
        </label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Road Breaker"
          className="h-11"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6B35]" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-slate-900">Détection de chute</div>
            <p className="mt-1 text-xs text-slate-600">
              Détection expérimentale via les capteurs du téléphone. Ne remplace pas un appel
              d'urgence si tu es capable d'appeler toi-même.
            </p>
          </div>
          <button
            onClick={() => setCrashEnabled(!crashEnabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              crashEnabled ? "bg-[#FF6B35]" : "bg-slate-300"
            }`}
            aria-label="Activer la détection"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                crashEnabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <Vibrate className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-slate-900">Vibrations</div>
            <p className="mt-1 text-xs text-slate-600">
              Retour tactile sur les taps, les alertes de zone de danger et les
              actions rapides en convoi. Sans effet si l'appareil ne supporte
              pas les vibrations (iOS Safari).
            </p>
          </div>
          <button
            onClick={() => setVibrationEnabled(!vibrationEnabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              vibrationEnabled ? "bg-[#FF6B35]" : "bg-slate-300"
            }`}
            aria-label="Activer les vibrations"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                vibrationEnabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>


      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Contacts d'urgence</div>
          <div className="text-xs text-slate-500">{contacts.length}/3</div>
        </div>
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-[#FF6B35]">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                  {c.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {contacts.length < 3 && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Ajouter un contact</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="h-11" />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone (ex. +33 6…)"
            className="h-11"
            type="tel"
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (facultatif)"
            className="h-11"
            type="email"
          />
          <Button onClick={submit} className="h-11 w-full" disabled={!name.trim() || (!phone.trim() && !email.trim())}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}
