import { GUEST_USER_ID, readGuestData, writeGuestData } from "./access-mode";
import { useVigla } from "./vigla-store";
import type { HazardReport, HazardType } from "@/types/vigla";

export function loadGuestHazards(): HazardReport[] {
  return readGuestData<HazardReport[]>("hazards", []).filter(row => Date.parse(row.expires_at) > Date.now());
}

export function saveGuestHazard(type: HazardType, latitude: number, longitude: number) {
  const now = Date.now();
  const row: HazardReport = {
    id: `guest-hazard-${crypto.randomUUID()}`, type, latitude, longitude,
    reported_by: GUEST_USER_ID, confidence_score: 1, confirmed_count: 0, denied_count: 0,
    created_at: new Date(now).toISOString(), expires_at: new Date(now + 3600000).toISOString(),
  };
  writeGuestData("hazards", [...loadGuestHazards(), row]);
  useVigla.getState().upsertHazard(row);
  return row;
}