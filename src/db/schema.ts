import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Money is stored in thousandths of the currency unit (45.5 is 45500).
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** The one store of this install: row id 1. */
export const storeSettings = sqliteTable("store_settings", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().default("My store"),
  description: text("description").notNull().default(""),
  currency: text("currency").notNull().default("TND"),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(now),
});

/** Members the app has seen, keyed by the Gateway's user id. */
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    sku: text("sku").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    status: text("status", { enum: ["active", "draft"] })
      .notNull()
      .default("draft"),
    imageKey: text("image_key"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    // An order that would take stock below zero fails its whole batch.
    check("products_stock_nonnegative", sql`stock >= 0`),
    index("products_status_idx").on(t.status),
  ],
);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(now),
});

import { ORDER_STATUSES } from "../lib/statuses";

export { ORDER_STATUSES, type OrderStatus } from "../lib/statuses";

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  courier: text("courier").notNull(),
  amount: integer("amount").notNull(),
  orderCount: integer("order_count").notNull(),
  memberId: text("member_id").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull().unique(),
    token: text("token").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull(),
    note: text("note").notNull().default(""),
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    currency: text("currency").notNull(),
    paymentMethod: text("payment_method").notNull().default("cod"),
    status: text("status", { enum: ORDER_STATUSES })
      .notNull()
      .default("pending"),
    source: text("source", { enum: ["storefront", "manual"] }).notNull(),
    assigneeId: text("assignee_id").references(() => members.id),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    collectionId: text("collection_id").references(() => collections.id),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderLines = sqliteTable(
  "order_lines",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    // Null once the product is deleted; the snapshot stays.
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    status: text("status", { enum: ORDER_STATUSES }).notNull(),
    // Null when the customer placed the order on the storefront.
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);
