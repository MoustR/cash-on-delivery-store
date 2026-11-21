import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as customers from "@/server/customers";
import { getSettings } from "@/server/settings";
import { actorMiddleware } from "./middleware";

export const getCustomers = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => customers.listCustomersInput.parse(data))
  .handler(async ({ data }) => ({
    customers: await customers.listCustomers(data),
    currency: (await getSettings()).currency,
  }));

export const getCustomer = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => ({
    customer: await customers.getCustomer(data.id),
    isAdmin: context.actor.admin,
  }));

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => customers.updateCustomerInput.parse(data))
  .handler(({ data }) => customers.updateCustomer(data));

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(({ data, context }) =>
    customers.deleteCustomer(context.actor, data.id),
  );
