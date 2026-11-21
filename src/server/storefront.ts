import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orderLines, orders, products } from "@/db/schema";
import { getSettings } from "./settings";

// Only what a shopper may see: no SKU, cost, exact stock or drafts.
const publicFields = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  description: products.description,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  imageKey: products.imageKey,
  stock: products.stock,
};

type PublicRow = { stock: number } & Record<string, unknown>;
function hideStock<T extends PublicRow>({ stock, ...rest }: T) {
  return { ...rest, inStock: stock > 0 } as Omit<T, "stock"> & {
    inStock: boolean;
  };
}

export async function catalogue() {
  const settings = await getSettings();
  const store = {
    name: settings.name,
    description: settings.description,
    currency: settings.currency,
    deliveryFee: settings.deliveryFee,
    isOpen: settings.isOpen,
  };
  if (!settings.isOpen) return { store, products: [] };
  const rows = await db
    .select(publicFields)
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(asc(products.name));
  return { store, products: rows.map(hideStock) };
}

export async function publicProduct(slug: string) {
  const { store } = await catalogue();
  if (!store.isOpen) return { store, product: null };
  const [row] = await db
    .select(publicFields)
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "active")));
  return { store, product: row ? hideStock(row) : null };
}

/** Whether an image belongs to a product the storefront shows. */
export async function isPublicImage(key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.imageKey, key), eq(products.status, "active")));
  return Boolean(row);
}

/** The parcel page: one order, the first name only, no notes. */
export async function tracking(token: string) {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      customerName: orders.customerName,
      total: orders.total,
      deliveryFee: orders.deliveryFee,
      currency: orders.currency,
      status: orders.status,
      courier: orders.courier,
      trackingNumber: orders.trackingNumber,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.token, token));
  if (!order) return null;
  const [lines, events, settings] = await Promise.all([
    db
      .select({
        name: orderLines.name,
        unitPrice: orderLines.unitPrice,
        qty: orderLines.qty,
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, order.id))
      .orderBy(orderLines.name),
    db
      .select({ status: orderEvents.status, createdAt: orderEvents.createdAt })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(orderEvents.createdAt, orderEvents.id),
    getSettings(),
  ]);
  const { id: _id, customerName, ...shown } = order;
  return {
    storeName: settings.name,
    order: { ...shown, firstName: customerName.split(/\s+/)[0] ?? "" },
    lines,
    events,
  };
}
