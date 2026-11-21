import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orderLines, products } from "@/db/schema";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/pipeline";
import { AppError, requireAdmin, type Actor } from "./actor";

export const LOW_STOCK = 5;

export const listProductsInput = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(["active", "draft"]).optional(),
  })
  .strict();

export function listProducts({ q, status }: z.infer<typeof listProductsInput>) {
  const filters = [];
  if (status) filters.push(eq(products.status, status));
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        like(products.name, pattern),
        like(products.sku, pattern),
        like(products.slug, pattern),
      ),
    );
  }
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      sku: products.sku,
      price: products.price,
      stock: products.stock,
      status: products.status,
      imageKey: products.imageKey,
    })
    .from(products)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(products.createdAt), products.id);
}

export async function getProduct(id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  if (!row) throw new AppError("No product with that id", 404);
  return row;
}

export const productInput = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Give the product a name").max(120),
    slug: z.string().trim().max(80),
    description: z.string().trim().max(4000),
    price: z.string(),
    compareAtPrice: z.string(),
    sku: z.string().trim().max(60),
    stock: z.coerce
      .number()
      .int("Stock is a whole number")
      .min(0, "Stock can't be negative"),
    status: z.enum(["active", "draft"]),
    imageKey: z.string().max(100).nullable(),
  })
  .strict();

export async function saveProduct(input: z.infer<typeof productInput>) {
  const price = parseMoney(input.price);
  if (price === null) throw new AppError("Enter the price as an amount");
  let compareAtPrice: number | null = null;
  if (input.compareAtPrice.trim()) {
    compareAtPrice = parseMoney(input.compareAtPrice);
    if (compareAtPrice === null)
      throw new AppError("Enter the compare-at price as an amount");
  }
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new AppError("The slug needs a letter or digit");
  const [taken] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug));
  if (taken && taken.id !== input.id)
    throw new AppError(`Another product already uses the slug "${slug}"`, 409);
  const values = {
    name: input.name,
    slug,
    description: input.description,
    price,
    compareAtPrice,
    sku: input.sku,
    stock: input.stock,
    status: input.status,
    imageKey: input.imageKey,
    updatedAt: new Date().toISOString(),
  };
  if (input.id) {
    const [row] = await db
      .update(products)
      .set(values)
      .where(eq(products.id, input.id))
      .returning({ id: products.id });
    if (!row) throw new AppError("No product with that id", 404);
    return row;
  }
  const [row] = await db
    .insert(products)
    .values({ id: crypto.randomUUID(), ...values })
    .returning({ id: products.id });
  return row!;
}

/** Deletes a product, or archives it to draft when orders refer to it. */
export async function deleteProduct(actor: Actor, id: string) {
  requireAdmin(actor, "delete products");
  const product = await getProduct(id);
  const [used] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orderLines)
    .where(eq(orderLines.productId, id));
  if (used && used.n > 0) {
    await db
      .update(products)
      .set({ status: "draft", updatedAt: new Date().toISOString() })
      .where(eq(products.id, id));
    return { archived: true, imageKey: null };
  }
  await db.delete(products).where(eq(products.id, id));
  return { archived: false, imageKey: product.imageKey };
}

export function productsByIds(ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return db.select().from(products).where(inArray(products.id, ids));
}
