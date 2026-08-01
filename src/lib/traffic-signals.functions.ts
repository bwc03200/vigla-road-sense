import { createServerFn } from "@tanstack/react-start";
import { queryTrafficSignals } from "./traffic-signals.server";

export const getTrafficSignals = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as Record<string, number>)
  .handler(async ({ data }) => {
    try {
      const signals = await queryTrafficSignals({
        south: Number(data.south),
        west: Number(data.west),
        north: Number(data.north),
        east: Number(data.east),
      });
      return { ok: true as const, signals };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
