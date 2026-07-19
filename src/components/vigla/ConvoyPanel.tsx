import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, LogOut, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVigla } from "@/lib/vigla-store";
import { useConvoy } from "@/hooks/useConvoy";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

export function ConvoyPanel({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
    if (!displayName.trim()) return toast.error(t("convoy.chooseNickname"));
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createConvoy(name.trim());
      setName("");
    } catch (e) {
       
      console.error("[ConvoyPanel.handleCreate] unexpected exception:", e);
      toast.error(t("convoy.createFailed"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }
  async function handleJoin() {
    if (!displayName.trim()) return toast.error(t("convoy.chooseNickname"));
    if (!code.trim()) return;
    setBusy(true);
    try {
      await joinConvoy(code);
      setCode("");
    } catch (e) {
       
      console.error("[ConvoyPanel.handleJoin] unexpected exception:", e);
      toast.error(t("convoy.joinFailed"), {
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
              <div className="text-xs uppercase tracking-widest text-slate-500">{t("convoy.activeConvoy")}</div>
              <div className="mt-0.5 text-lg font-semibold text-slate-900">{convoy.name}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(convoy.code);
                toast.success(t("convoy.codeCopied", { code: convoy.code }));
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
            {t("convoy.membersLabel", { n: members.length })}
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
                      : t("convoy.unknownPosition")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="secondary" className="h-12 w-full">
              <LogOut className="mr-2 h-4 w-4" />
              {t("convoy.leaveBtn")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("convoy.leaveTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("convoy.leaveDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLeaveDialogOpen(false)}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setLeaveDialogOpen(false); leaveConvoy(); }}
                className="bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90"
              >
                {t("convoy.leaveConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-3 rounded-2xl bg-orange-50 p-4">
        <Users className="h-6 w-6 text-[#FF6B35]" />
        <div>
          <div className="text-sm font-semibold text-slate-900">{t("convoy.rideTogether")}</div>
          <div className="text-xs text-slate-600">{t("convoy.rideTogetherDesc")}</div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
          {t("convoy.nickname")}
        </label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("convoy.nicknamePlaceholder")}
          className="h-12"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-900">{t("convoy.create")}</div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("convoy.namePlaceholder")}
          className="h-11"
        />
        <Button className="mt-3 h-11 w-full" onClick={handleCreate} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("convoy.createBtn")}
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-slate-900">{t("convoy.joinWithCode")}</div>
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
          {t("convoy.join")}
        </Button>
      </div>
    </div>
  );
}
