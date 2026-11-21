import { desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { AppError, requireAdmin, type Actor } from "./actor";

function parseTags(tags: string): string[] {
  try {
    const value: unknown = JSON.parse(tags);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export const listCustomersInput = z.object({
  q: z.string().trim().max(100).optional(),
});

export async function listCustomers({ q }: z.infer<typeof listCustomersInput>) {
  const where = q
    ? or(
        like(customers.name, `%${q}%`),
        like(customers.phone, `%${q.replace(/\s/g, "")}%`),
        like(customers.city, `%${q}%`),
        like(customers.tags, `%${q}%`),
      )
    : undefined;
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      city: customers.city,
      tags: customers.tags,
      orderCount: sql<number>`count(${orders.id})`,
      spent: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.total} else 0 end), 0)`,
      lastOrderAt: sql<string | null>`max(${orders.createdAt})`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(where)
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${orders.createdAt})`), customers.name)
    .limit(200);
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

export async function getCustomer(id: string) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  if (!row) throw new AppError("No customer with that id", 404);
  const history = await db
    .select({
      id: orders.id,
      number: orders.number,
      total: orders.total,
      currency: orders.currency,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(desc(orders.createdAt));
  return { ...row, tags: parseTags(row.tags), orders: history };
}

export const updateCustomerInput = z.object({
  id: z.string().min(1),
  notes: z.string().max(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});

export async function updateCustomer(
  input: z.infer<typeof updateCustomerInput>,
) {
  const tags = [...new Set(input.tags.map((t) => t.toLowerCase()))];
  const [row] = await db
    .update(customers)
    .set({ notes: input.notes, tags: JSON.stringify(tags) })
    .where(eq(customers.id, input.id))
    .returning({ id: customers.id });
  if (!row) throw new AppError("No customer with that id", 404);
  return row;
}

export async function deleteCustomer(actor: Actor, id: string) {
  requireAdmin(actor, "delete customers");
  const [used] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.customerId, id));
  if (used && used.n > 0)
    throw new AppError("Customers with orders can't be deleted.", 409);
  await db.delete(customers).where(eq(customers.id, id));
  return { ok: true };
}
