import type { OrderStatus } from "@/lib/statuses";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  paid: "Paid",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "paid",
  "cancelled",
  "returned",
];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["paid", "returned"],
  paid: [],
  cancelled: [],
  returned: [],
};

/** Where an order in `from` may go next. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return NEXT[from];
}

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

/** Moving here puts the order's items back in stock. */
export function restocks(to: OrderStatus): boolean {
  return to === "cancelled" || to === "returned";
}

/** A member may change an order that is unassigned or theirs; admins any. */
export function mayChangeOrder(
  actor: { id: string; admin: boolean },
  assigneeId: string | null,
): boolean {
  return actor.admin || assigneeId === null || assigneeId === actor.id;
}

/** Why a move is refused, or null when it is allowed. */
export function refusal(
  actor: { id: string; admin: boolean },
  order: { status: OrderStatus; assigneeId: string | null },
  to: OrderStatus,
): string | null {
  if (!mayChangeOrder(actor, order.assigneeId))
    return "assigned to another member";
  if (!canMove(order.status, to))
    return `${STATUS_LABELS[order.status].toLowerCase()} orders can't move to ${STATUS_LABELS[to].toLowerCase()}`;
  return null;
}

/** Digits only, so "+216 22 345 678" and "22345678" can match. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^\+?216(?=\d{8}$)/, "");
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
