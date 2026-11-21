import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listMembers } from "@/server/actor";
import { listOrdersInput } from "@/lib/search";
import * as orders from "@/server/orders";
import { actorMiddleware } from "./middleware";

export const getOrders = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => listOrdersInput.parse(data))
  .handler(({ data }) => orders.listOrders(data));

export const getOrder = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context: { actor } }) => ({
    order: await orders.getOrder(data.id),
    members: await listMembers(),
    me: { id: actor.id, admin: actor.admin },
  }));

export const createManualOrder = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => orders.newOrderInput.parse(data))
  .handler(({ data, context }) => orders.placeOrder(data, context.actor));

export const changeOrderStatus = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => orders.changeStatusInput.parse(data))
  .handler(({ data, context }) => orders.changeStatus(context.actor, data));

export const bulkChangeOrderStatus = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => orders.bulkStatusInput.parse(data))
  .handler(({ data, context }) => orders.bulkChangeStatus(context.actor, data));

export const assignOrder = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => orders.assignInput.parse(data))
  .handler(({ data, context }) => orders.assignOrder(context.actor, data));
