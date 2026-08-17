/**
 * Reverse-geocode a lat/lon pair to a city name using Nominatim.
 * Returns null when no name can be resolved or the request fails.
 */
export async function fetchCityName(
  lat: number,
  lon: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", "12");

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("❌ [NOMINATIM ERROR]", response.status);
      return null;
    }

    const data = (await response.json()) as {
      address?: Record<string, string | undefined>;
    };
    const a = data.address ?? {};
    return (
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.region ?? null
    );
  } catch (err) {
    console.error("❌ [NOMINATIM TIMEOUT]", err);
    clearTimeout(timeoutId);
    return null;
  }
}
