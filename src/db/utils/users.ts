import { eq } from "drizzle-orm";
import { db } from "..";
import { User, users } from "../schema";

export const updateUser = async (id: number, changes: Partial<Omit<User, 'id'>>) => {
  await db
    .update(users)
    .set(changes)
    .where(eq(users.id, id));
}

export const getUserAvatarId = async (id: number) => {
  const list = await db
    .select({
      avatarId: users.avatarId,
    })
    .from(users)
    .where(eq(users.id, id));
  return list.at(0);
}