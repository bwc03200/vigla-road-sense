import { createServerFn } from "@tanstack/react-start";
import { queryFastfoods } from "./fastfoods.server";

export const getFastfoods = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data as Record<string, number>)
  .handler(async ({ data }) =>
    queryFastfoods({
      south: Number(data.south),
      west: Number(data.west),
      north: Number(data.north),
      east: Number(data.east),
    }),
  );
