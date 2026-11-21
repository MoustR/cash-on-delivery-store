import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import * as products from "@/server/products";
import { getSettings } from "@/server/settings";
import { actorMiddleware } from "./middleware";

export const getProducts = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => products.listProductsInput.parse(data))
  .handler(async ({ data }) => ({
    products: await products.listProducts(data),
    currency: (await getSettings()).currency,
    lowStock: products.LOW_STOCK,
  }));

export const getProduct = createServerFn()
  .middleware([actorMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => ({
    product: await products.getProduct(data.id),
    isAdmin: context.actor.admin,
  }));

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => products.productInput.parse(data))
  .handler(({ data }) => products.saveProduct(data));

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await products.deleteProduct(context.actor, data.id);
    if (result.imageKey) await env.files.delete(result.imageKey);
    return { archived: result.archived };
  });

/** Active products for the manual order form. */
export const getOrderableProducts = createServerFn()
  .middleware([actorMiddleware])
  .handler(async () => ({
    products: (await products.listProducts({ status: "active" })).map(
      ({ id, name, price, stock }) => ({ id, name, price, stock }),
    ),
    settings: await getSettings(),
  }));
