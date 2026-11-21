import { createMiddleware } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorFor } from "@/server/actor";

/** The signed-in member as `context.actor`: id, email and whether they're an admin. */
export const actorMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) =>
    next({ context: { actor: await actorFor(context.user) } }),
  );
