import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Globe, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVigla } from "@/lib/vigla-store";
import { useRoadbooks } from "@/hooks/useRoadbooks";
import type { Roadbook } from "@/types/vigla";
import { buildRouteState } from "@/lib/routing";

type Tab = "public" | "mine";

export function RoadbookList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const roadbooks = useVigla((s) => s.roadbooks);
  const route = useVigla((s) => s.route);
  const hazards = useVigla((s) => s.hazards);
  const setRoute = useVigla((s) => s.setRoute);
  const { create, remove } = useRoadbooks(userId);
  const [tab, setTab] = useState<Tab>("mine");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [isPublic, setIsPublic] = useState(false);

  const filtered = roadbooks.filter((r) =>
    tab === "public" ? r.is_public : r.created_by === userId,
  );

  async function submit() {
    if (!title.trim()) return;
    await create({
      title: title.trim(),
      description: description.trim(),
      durationDays,
      distanceKm: route ? +(route.distanceM / 1000).toFixed(1) : undefined,
      coords: route?.coords,
      destination: route?.destination,
      isPublic,
    });
    setTitle("");
    setDescription("");
    setDurationDays(1);
    setIsPublic(false);
    setCreating(false);
  }

  function loadRoadbook(rb: Roadbook) {
    const geo = rb.route_geojson;
    if (!geo?.coords || !geo?.destination) {
      toast.error(t("roadbooks.noTrack"));
      return;
    }
    const state = buildRouteState(
      geo.destination,
      {
        coords: geo.coords,
        distanceM: (rb.distance_km ?? 0) * 1000,
        durationS: (rb.duration_days ?? 1) * 3600,
        steps: [],
      },
      hazards,
    );
    setRoute(state);
    toast.success(t("roadbooks.loaded"));
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        {(["public", "mine"] as Tab[]).map((tt) => (
          <button
            key={tt}
            onClick={() => setTab(tt)}
            className={`rounded-lg py-2 text-sm font-medium transition ${
              tab === tt ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {tt === "public" ? t("roadbooks.public") : t("roadbooks.mine")}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">{t("roadbooks.newRoadbook")}</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("roadbooks.titleLabel")} className="h-11" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("roadbooks.descriptionLabel")}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm"
            rows={3}
          />
          <div className="flex items-center gap-3 text-sm">
            <label className="text-slate-600">{t("roadbooks.daysLabel")}</label>
            <Input
              type="number"
              min={1}
              max={30}
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
              className="h-10 w-20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {t("roadbooks.publish")}
          </label>
          {!route && (
            <p className="text-xs text-amber-700">{t("roadbooks.noRouteWarning")}</p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" className="h-11 flex-1" onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="h-11 flex-1" onClick={submit} disabled={!title.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="h-11 w-full" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {route ? t("roadbooks.createFromRoute") : t("roadbooks.createBtn")}
        </Button>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <BookOpen className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-500">
            {tab === "public" ? t("roadbooks.emptyPublic") : t("roadbooks.emptyMine")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rb) => (
            <div
              key={rb.id}
              className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{rb.title}</div>
                    {rb.is_public ? (
                      <Globe className="h-3 w-3 text-slate-400" />
                    ) : (
                      <Lock className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {rb.duration_days ?? 1} {t("common.days")}
                    {rb.distance_km != null && ` · ${rb.distance_km.toFixed(0)} km`}
                  </div>
                </div>
                {rb.created_by === userId && (
                  <button
                    onClick={() => remove(rb.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {rb.description && (
                <p className="text-xs text-slate-600">{rb.description}</p>
              )}
              {rb.route_geojson?.coords && (
                <Button
                  variant="secondary"
                  className="h-10 w-full"
                  onClick={() => loadRoadbook(rb)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {t("roadbooks.loadAsRoute")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
