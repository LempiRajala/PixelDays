import { eq } from "drizzle-orm";
import { db } from "..";
import { type User, users } from "../schema";

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

export const getUserBannerId = async (id: number) => {
  const list = await db
    .select({
      bannerId: users.bannerId,
    })
    .from(users)
    .where(eq(users.id, id));
  return list.at(0);
}

export const getUser = async (id: number) => {
  const list = await db
    .select()
    .from(users)
    .where(eq(users.id, id));
  return list.at(0) ?? null;
}