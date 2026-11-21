import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  customers,
  members,
  orderEvents,
  orderLines,
  orders,
  ORDER_STATUSES,
  products,
  type OrderStatus,
} from "@/db/schema";
import {
  mayChangeOrder,
  normalizePhone,
  refusal,
  restocks,
} from "@/lib/pipeline";
import { type ListOrdersInput } from "@/lib/search";
import { AppError, type Actor } from "./actor";
import { getSettings } from "./settings";

export const PAGE_SIZE = 20;

export const customerFields = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((p) => normalizePhone(p).replace("+", "").length >= 6, {
      message: "Enter a phone number",
    }),
  city: z.string().trim().min(1, "Enter the city").max(80),
  address: z.string().trim().min(1, "Enter the address").max(300),
  note: z.string().trim().max(500).optional(),
});

export const newOrderInput = z.object({
  customer: customerFields,
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(100),
        qty: z.coerce.number().int().min(1).max(999),
      }),
    )
    .min(1, "Add at least one product")
    .max(50),
});

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Places an order from the storefront (actor null) or the back office.
 * Prices come from the database; the client's are never read. The order,
 * its lines, the customer and the stock change are one batch, and the
 * products' CHECK (stock >= 0) fails the whole batch when stock runs short.
 */
export async function placeOrder(
  input: z.infer<typeof newOrderInput>,
  actor: Actor | null,
): Promise<{ id: string; number: number; token: string }> {
  const settings = await getSettings();
  if (!settings.isOpen)
    throw new AppError("The store is closed and isn't taking orders.", 409);

  const wanted = new Map<string, number>();
  for (const line of input.lines)
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.qty);
  const rows = await db
    .select()
    .from(products)
    .where(inArray(products.id, [...wanted.keys()]));
  const byId = new Map(rows.map((p) => [p.id, p]));
  const lines = [...wanted].map(([productId, qty]) => {
    const product = byId.get(productId);
    if (!product || product.status !== "active")
      throw new AppError("A product in the cart is no longer available.", 409);
    if (product.stock < qty)
      throw new AppError(
        product.stock === 0
          ? `${product.name} is out of stock.`
          : `Only ${product.stock} of ${product.name} left.`,
        409,
      );
    return { product, qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const phone = normalizePhone(input.customer.phone);
  const orderId = crypto.randomUUID();
  const token = randomToken();
  const c = input.customer;

  const statements = [
    db
      .insert(customers)
      .values({
        id: crypto.randomUUID(),
        phone,
        name: c.name,
        city: c.city,
        address: c.address,
      })
      .onConflictDoNothing({ target: customers.phone }),
    db.insert(orders).values({
      id: orderId,
      number: sql`(select coalesce(max(${orders.number}), 1000) + 1 from ${orders})`,
      token,
      customerId: sql`(select ${customers.id} from ${customers} where ${customers.phone} = ${phone})`,
      customerName: c.name,
      phone,
      city: c.city,
      address: c.address,
      note: c.note ?? "",
      subtotal,
      deliveryFee: settings.deliveryFee,
      total: subtotal + settings.deliveryFee,
      currency: settings.currency,
      paymentMethod: "cod",
      status: "pending",
      source: actor ? "manual" : "storefront",
      createdAt: new Date().toISOString(),
    }),
    db.insert(orderLines).values(
      lines.map((l) => ({
        id: crypto.randomUUID(),
        orderId,
        productId: l.product.id,
        name: l.product.name,
        unitPrice: l.product.price,
        qty: l.qty,
      })),
    ),
    ...lines.map((l) =>
      db
        .update(products)
        .set({ stock: sql`${products.stock} - ${l.qty}` })
        .where(eq(products.id, l.product.id)),
    ),
    db.insert(orderEvents).values({
      id: crypto.randomUUID(),
      orderId,
      status: "pending",
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
    }),
  ] as const;

  try {
    await db.batch(statements);
  } catch (error) {
    const text = String((error as { cause?: unknown })?.cause ?? error);
    if (text.includes("CHECK"))
      throw new AppError("Some items just ran out of stock.", 409);
    if (text.includes("UNIQUE"))
      throw new AppError(
        "Another order came in at the same moment. Try again.",
        409,
      );
    throw error;
  }
  const [row] = await db
    .select({ number: orders.number })
    .from(orders)
    .where(eq(orders.id, orderId));
  return { id: orderId, number: row!.number, token };
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function listOrders(input: ListOrdersInput) {
  const filters: SQL[] = [];
  if (input.status) filters.push(eq(orders.status, input.status));
  if (input.from) filters.push(gte(orders.createdAt, input.from));
  if (input.to) filters.push(lt(orders.createdAt, nextDay(input.to)));
  if (input.q) {
    const q = input.q;
    const any: SQL[] = [like(orders.customerName, `%${q}%`)];
    const digits = q.replace(/\D/g, "");
    if (digits) any.push(like(orders.phone, `%${digits}%`));
    if (/^#?\d+$/.test(q))
      any.push(eq(orders.number, Number(q.replace("#", ""))));
    filters.push(or(...any)!);
  }
  const where = filters.length ? and(...filters) : undefined;
  const column = {
    number: orders.number,
    date: orders.createdAt,
    total: orders.total,
    customer: orders.customerName,
  }[input.sort ?? "date"];
  const order = input.dir === "asc" ? asc(column) : desc(column);
  const [count] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(where);
  const total = count?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(input.page ?? 1, pageCount);
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      customerName: orders.customerName,
      phone: orders.phone,
      city: orders.city,
      total: orders.total,
      currency: orders.currency,
      status: orders.status,
      courier: orders.courier,
      createdAt: orders.createdAt,
      assigneeEmail: members.email,
    })
    .from(orders)
    .leftJoin(members, eq(members.id, orders.assigneeId))
    .where(where)
    .orderBy(order, desc(orders.number))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { rows, total, page, pageCount };
}

export async function getOrder(id: string) {
  const [order] = await db
    .select({
      order: orders,
      assigneeEmail: members.email,
    })
    .from(orders)
    .leftJoin(members, eq(members.id, orders.assigneeId))
    .where(eq(orders.id, id));
  if (!order) throw new AppError("No order with that id", 404);
  const [lines, events] = await Promise.all([
    db
      .select({
        id: orderLines.id,
        productId: orderLines.productId,
        name: orderLines.name,
        unitPrice: orderLines.unitPrice,
        qty: orderLines.qty,
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, id))
      .orderBy(orderLines.name),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, id))
      .orderBy(orderEvents.createdAt, orderEvents.id),
  ]);
  return { ...order.order, assigneeEmail: order.assigneeEmail, lines, events };
}

export const changeStatusInput = z.object({
  id: z.string().min(1),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
  courier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
});
type ChangeExtras = Omit<z.infer<typeof changeStatusInput>, "id" | "to">;

type OrderRow = typeof orders.$inferSelect;

/** Moves one order, or returns why it can't. */
async function move(
  actor: Actor,
  order: OrderRow,
  to: OrderStatus,
  extras: ChangeExtras,
): Promise<string | null> {
  const why = refusal(actor, order, to);
  if (why) return why;
  if (to === "shipped" && !extras.courier)
    return "a courier is required to ship";
  const stamp = new Date().toISOString();
  const changed = await db
    .update(orders)
    .set({
      status: to,
      updatedAt: stamp,
      ...(to === "shipped"
        ? {
            courier: extras.courier,
            trackingNumber: extras.trackingNumber || null,
          }
        : {}),
    })
    .where(
      and(
        eq(orders.id, order.id),
        eq(orders.status, order.status),
        actor.admin
          ? undefined
          : or(isNull(orders.assigneeId), eq(orders.assigneeId, actor.id)),
      ),
    )
    .returning({ id: orders.id });
  if (!changed.length) return "it changed in the meantime";
  const lines = restocks(to)
    ? await db
        .select({ productId: orderLines.productId, qty: orderLines.qty })
        .from(orderLines)
        .where(eq(orderLines.orderId, order.id))
    : [];
  await db.batch([
    db.insert(orderEvents).values({
      id: crypto.randomUUID(),
      orderId: order.id,
      status: to,
      actorId: actor.id,
      actorEmail: actor.email,
      note: extras.note ?? "",
      createdAt: stamp,
    }),
    ...lines
      .filter((l) => l.productId)
      .map((l) =>
        db
          .update(products)
          .set({ stock: sql`${products.stock} + ${l.qty}` })
          .where(eq(products.id, l.productId!)),
      ),
  ]);
  return null;
}

async function orderRow(id: string): Promise<OrderRow> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new AppError("No order with that id", 404);
  return order;
}

export async function changeStatus(
  actor: Actor,
  { id, to, ...extras }: z.infer<typeof changeStatusInput>,
) {
  const why = await move(actor, await orderRow(id), to, extras);
  if (why) throw new AppError(`Can't change this order: ${why}.`, 409);
  return { ok: true };
}

export const bulkStatusInput = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  to: z.enum(ORDER_STATUSES),
  courier: z.string().trim().max(80).optional(),
});

export async function bulkChangeStatus(
  actor: Actor,
  { ids, to, courier }: z.infer<typeof bulkStatusInput>,
) {
  const rows = await db.select().from(orders).where(inArray(orders.id, ids));
  rows.sort((a, b) => a.number - b.number);
  const updated: number[] = [];
  const skipped: { number: number; reason: string }[] = [];
  for (const order of rows) {
    const why = await move(actor, order, to, { courier });
    if (why) skipped.push({ number: order.number, reason: why });
    else updated.push(order.number);
  }
  return { updated, skipped };
}

export const assignInput = z.object({
  id: z.string().min(1),
  assigneeId: z.string().min(1).nullable(),
});

export async function assignOrder(
  actor: Actor,
  { id, assigneeId }: z.infer<typeof assignInput>,
) {
  const order = await orderRow(id);
  if (!mayChangeOrder(actor, order.assigneeId))
    throw new AppError("This order is assigned to another member.", 403);
  if (!actor.admin && assigneeId !== null && assigneeId !== actor.id)
    throw new AppError("Only admins can assign orders to someone else.", 403);
  if (assigneeId) {
    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, assigneeId));
    if (!member) throw new AppError("No member with that id", 404);
  }
  await db
    .update(orders)
    .set({ assigneeId, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id));
  return { ok: true };
}
