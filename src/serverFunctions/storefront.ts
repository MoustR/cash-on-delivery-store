import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as storefront from "@/server/storefront";

// The storefront's data. No identity: shoppers have none. Each returns only
// what a shopper may see (src/server/storefront.ts). The pages call these
// from their loaders during server rendering.
export const getCatalogue = createServerFn().handler(() =>
  storefront.catalogue(),
);

export const getPublicProduct = createServerFn()
  .validator((data: unknown) =>
    z.object({ slug: z.string().max(100) }).parse(data),
  )
  .handler(({ data }) => storefront.publicProduct(data.slug));

export const getTracking = createServerFn()
  .validator((data: unknown) =>
    z.object({ token: z.string().max(100) }).parse(data),
  )
  .handler(({ data }) => storefront.tracking(data.token));
