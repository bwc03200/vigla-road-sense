import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryTrafficSignals } from "./traffic-signals.server";

export const getTrafficSignals = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        south: z.number(),
        west: z.number(),
        north: z.number(),
        east: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => queryTrafficSignals(data));
