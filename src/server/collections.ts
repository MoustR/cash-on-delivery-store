import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { collections, members, orderEvents, orders } from "@/db/schema";
import { mayChangeOrder } from "@/lib/pipeline";
import { AppError, type Actor } from "./actor";

/** Delivered orders whose cash hasn't come back yet, by courier. */
export async function uncollected() {
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      customerName: orders.customerName,
      city: orders.city,
      total: orders.total,
      courier: orders.courier,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .where(and(eq(orders.status, "delivered"), isNull(orders.collectionId)))
    .orderBy(orders.courier, orders.number);
  const groups = new Map<
    string,
    { courier: string; count: number; amount: number; orders: typeof rows }
  >();
  for (const row of rows) {
    const courier = row.courier ?? "No courier";
    const group = groups.get(courier) ?? {
      courier,
      count: 0,
      amount: 0,
      orders: [],
    };
    group.count += 1;
    group.amount += row.total;
    group.orders.push(row);
    groups.set(courier, group);
  }
  return [...groups.values()];
}

export const collectInput = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/** Records the cash received for these orders and marks them paid. */
export async function collect(
  actor: Actor,
  { ids }: z.infer<typeof collectInput>,
) {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        inArray(orders.id, ids),
        eq(orders.status, "delivered"),
        isNull(orders.collectionId),
      ),
    );
  const allowed = rows.filter((o) => mayChangeOrder(actor, o.assigneeId));
  if (!allowed.length)
    throw new AppError("None of these orders can be collected.", 409);
  const byCourier = new Map<string, typeof allowed>();
  for (const o of allowed) {
    const courier = o.courier ?? "No courier";
    byCourier.set(courier, [...(byCourier.get(courier) ?? []), o]);
  }
  const stamp = new Date().toISOString();
  for (const [courier, group] of byCourier) {
    const collectionId = crypto.randomUUID();
    const groupIds = group.map((o) => o.id);
    await db.batch([
      db.insert(collections).values({
        id: collectionId,
        courier,
        amount: group.reduce((s, o) => s + o.total, 0),
        orderCount: group.length,
        memberId: actor.id,
        createdAt: stamp,
      }),
      db
        .update(orders)
        .set({ status: "paid", collectionId, updatedAt: stamp })
        .where(
          and(
            inArray(orders.id, groupIds),
            eq(orders.status, "delivered"),
            isNull(orders.collectionId),
          ),
        ),
      db.insert(orderEvents).values(
        group.map((o) => ({
          id: crypto.randomUUID(),
          orderId: o.id,
          status: "paid" as const,
          actorId: actor.id,
          actorEmail: actor.email,
          note: `Cash received from ${courier}`,
          createdAt: stamp,
        })),
      ),
    ]);
  }
  return { collected: allowed.length, skipped: ids.length - allowed.length };
}

export function collectionHistory() {
  return db
    .select({
      id: collections.id,
      courier: collections.courier,
      amount: collections.amount,
      orderCount: collections.orderCount,
      memberEmail: members.email,
      createdAt: collections.createdAt,
    })
    .from(collections)
    .leftJoin(members, eq(members.id, collections.memberId))
    .orderBy(desc(collections.createdAt))
    .limit(50);
}

export const paidTotalsInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function paidTotals({ from, to }: z.infer<typeof paidTotalsInput>) {
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return db
    .select({
      courier: collections.courier,
      amount: sql<number>`sum(${collections.amount})`,
      orderCount: sql<number>`sum(${collections.orderCount})`,
    })
    .from(collections)
    .where(
      and(
        gte(collections.createdAt, from),
        lt(collections.createdAt, end.toISOString().slice(0, 10)),
      ),
    )
    .groupBy(collections.courier)
    .orderBy(collections.courier);
}
