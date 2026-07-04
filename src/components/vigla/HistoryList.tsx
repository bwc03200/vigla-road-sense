import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bell, MapPin } from "lucide-react";
import type { TripHistory } from "@/types/vigla";

export function HistoryList() {
  const [trips, setTrips] = useState<TripHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("trip_history")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      if (error) setError(error.message);
      else setTrips((data as TripHistory[]) ?? []);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (trips === null)
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (trips.length === 0)
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aucun trajet enregistré. Vos futurs déplacements apparaîtront ici.
        </p>
      </div>
    );

  return (
    <div className="space-y-3 p-4">
      {trips.map((t) => (
        <Card key={t.id} className="rounded-2xl border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {format(new Date(t.started_at), "dd MMM yyyy · HH:mm", { locale: fr })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t.distance_km.toFixed(1)} km
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
              <Bell className="h-3 w-3" />
              {t.alerts_received}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
