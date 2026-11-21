import { createServerFn } from "@tanstack/react-start";
import * as settings from "@/server/settings";
import { actorMiddleware } from "./middleware";

export const getStoreSettings = createServerFn()
  .middleware([actorMiddleware])
  .handler(async ({ context: { actor } }) => ({
    settings: await settings.getSettings(),
    isAdmin: actor.admin,
  }));

export const saveStoreSettings = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => settings.settingsInput.parse(data))
  .handler(({ data, context }) => settings.updateSettings(context.actor, data));
