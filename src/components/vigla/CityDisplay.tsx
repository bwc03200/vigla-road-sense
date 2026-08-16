/** Current city name badge (reverse-geocoded from GPS). */
export function CityDisplay({ city }: { city: string | null }) {
  if (!city) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-[100px] z-40 rounded-md bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
      {city}
    </div>
  );
}
