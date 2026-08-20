import { createServerFn } from "@tanstack/react-start";
import { queryGasStations } from "./gas-stations.server";

export const getGasStations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as Record<string, number>)
  .handler(async ({ data }) => {
    try {
      const stations = await queryGasStations({
        south: Number(data.south),
        west: Number(data.west),
        north: Number(data.north),
        east: Number(data.east),
      });
      return { ok: true as const, stations };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
