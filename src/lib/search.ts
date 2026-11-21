import { z } from "zod";
import { ORDER_STATUSES } from "./statuses";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The order list's filters, sort and page, as in its URL. */
export const listOrdersInput = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  from: day.optional(),
  to: day.optional(),
  sort: z.enum(["number", "date", "total", "customer"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type ListOrdersInput = z.infer<typeof listOrdersInput>;
