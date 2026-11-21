import { createServerFn } from "@tanstack/react-start";
import * as collections from "@/server/collections";
import { getSettings } from "@/server/settings";
import { actorMiddleware } from "./middleware";

export const getCollections = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => collections.paidTotalsInput.parse(data))
  .handler(async ({ data }) => {
    const [groups, history, totals, settings] = await Promise.all([
      collections.uncollected(),
      collections.collectionHistory(),
      collections.paidTotals(data),
      getSettings(),
    ]);
    return { groups, history, totals, currency: settings.currency };
  });

export const collectCash = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => collections.collectInput.parse(data))
  .handler(({ data, context }) => collections.collect(context.actor, data));
