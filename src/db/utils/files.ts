import { eq, inArray } from "drizzle-orm";
import { db } from "..";
import { File, files } from "../schema";
import { randomUUID } from 'node:crypto';

export const createFile = async (data: Omit<File, 'createdAt' | 'id'>) => {
  const created = await db
    .insert(files)
    .values({
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    })
    .$returningId();
  return created[0];
}

export const deleteFile = async (id: string) => {
  await db
    .delete(files)
    .where(eq(files.id, id));
}

export const getFiles = async (ids: string[]) => {
  return await db
    .select()
    .from(files)
    .where(inArray(files.id, ids));
}