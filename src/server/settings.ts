import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { parseMoney } from "@/lib/money";
import { AppError, requireAdmin, type Actor } from "./actor";

export interface StoreSettings {
  name: string;
  description: string;
  currency: string;
  deliveryFee: number;
  isOpen: boolean;
}

const DEFAULTS: StoreSettings = {
  name: "My store",
  description: "",
  currency: "TND",
  deliveryFee: 0,
  isOpen: false,
};

export async function getSettings(): Promise<StoreSettings> {
  const [row] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1));
  if (!row) return DEFAULTS;
  return {
    name: row.name,
    description: row.description,
    currency: row.currency,
    deliveryFee: row.deliveryFee,
    isOpen: row.isOpen,
  };
}

export const settingsInput = z
  .object({
    name: z.string().trim().min(1, "Give the store a name").max(80),
    description: z.string().trim().max(300),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code"),
    deliveryFee: z.string(),
    isOpen: z.boolean(),
  })
  .strict();

export async function updateSettings(
  actor: Actor,
  input: z.infer<typeof settingsInput>,
): Promise<StoreSettings> {
  requireAdmin(actor, "change store settings");
  const fee = parseMoney(input.deliveryFee);
  if (fee === null) throw new AppError("Enter the delivery fee as an amount");
  const values = {
    name: input.name,
    description: input.description,
    currency: input.currency,
    deliveryFee: fee,
    isOpen: input.isOpen,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(storeSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: storeSettings.id, set: values });
  return getSettings();
}
