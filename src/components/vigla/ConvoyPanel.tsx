import { useState } from "react";
import { Users, LogOut, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVigla } from "@/lib/vigla-store";
import { useConvoy } from "@/hooks/useConvoy";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export function ConvoyPanel({ userId }: { userId: string }) {
  const convoy = useVigla((s) => s.convoy);
  const members = useVigla((s) => s.convoyMembers);
  const displayName = useVigla((s) => s.displayName);
  const setDisplayName = useVigla((s) => s.setDisplayName);
  const { createConvoy, joinConvoy, leaveConvoy } = useConvoy(userId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);


  async function handleCreate() {
    if (!displayName.trim()) return toast.error("Choisis d'abord un pseudo");
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createConvoy(name.trim());
      setName("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ConvoyPanel.handleCreate] unexpected exception:", e);
      toast.error("Création du convoi impossible", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }
  async function handleJoin() {
    if (!displayName.trim()) return toast.error("Choisis d'abord un pseudo");
    if (!code.trim()) return;
    setBusy(true);
    try {
      await joinConvoy(code);
      setCode("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ConvoyPanel.handleJoin] unexpected exception:", e);
      toast.error("Impossible de rejoindre le convoi", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  if (convoy) {
    return (
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Convoi actif</div>
              <div className="mt-0.5 text-lg font-semibold text-slate-900">{convoy.name}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(convoy.code);
                toast.success(`Code ${convoy.code} copié`);
              }}
              className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-mono font-semibold text-slate-900"
            >
              {convoy.code}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            Membres ({members.length})
          </div>
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {m.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{m.display_name}</div>
                  <div className="text-xs text-slate-500">
                    {m.last_lat != null
                      ? `${m.last_lat.toFixed(3)}, ${m.last_lng?.toFixed(3)}`
                      : "Position inconnue"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button variant="secondary" className="h-12 w-full" onClick={leaveConvoy}>
          <LogOut className="mr-2 h-4 w-4" />
          Quitter le convoi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
        <Users className="h-6 w-6 text-[#FF6B35]" />
        <div>
          <div className="text-sm font-semibold text-slate-900">Rouler en convoi</div>
          <div className="text-xs text-slate-600">
            Suivez la position des autres membres et échangez des réactions rapides.
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
          Ton pseudo
        </label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Road Breaker"
          className="h-12"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-900">Créer un convoi</div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du convoi"
          className="h-11"
        />
        <Button className="mt-3 h-11 w-full" onClick={handleCreate} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Créer le convoi
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-900">Rejoindre avec un code</div>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A1B2C3"
          maxLength={6}
          className="h-11 font-mono uppercase"
        />
        <Button
          variant="secondary"
          className="mt-3 h-11 w-full"
          onClick={handleJoin}
          disabled={busy}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Rejoindre
        </Button>
      </div>
    </div>
  );
}
