import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { db } from "@/db";
import { members } from "@/db/schema";

export interface Actor {
  id: string;
  email: string;
  admin: boolean;
}

/** Thrown for a refusal the page shows as is. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** The signed-in member, recorded on first sight so orders can be assigned to them. */
export async function actorFor(user: EveryAppUser): Promise<Actor> {
  await db
    .insert(members)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: members.id, set: { email: user.email } });
  return { id: user.id, email: user.email, admin: isAdmin(user) };
}

export function requireAdmin(actor: Actor, what: string): void {
  if (!actor.admin) throw new AppError(`Only admins can ${what}.`, 403);
}

export function listMembers() {
  return db
    .select({ id: members.id, email: members.email })
    .from(members)
    .orderBy(members.email);
}
