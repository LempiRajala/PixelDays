import { desc, eq, sql } from "drizzle-orm";
import { db } from "..";
import { messages, users } from "../schema";

export const getMessagesByChannel = async ({
  channelId,
  limit,
}: {
  channelId: number;
  limit: number;
}) => {
  try {
    const list = await db
      .select({
        message: messages.message,
        flag: messages.flag,
        uid: messages.uid,
        ts: sql<number>`UNIX_TIMESTAMP(${messages.createdAt})`.as('ts'),
        name: users.name,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.uid))
      .where(eq(messages.cid, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  
    return list.reverse();
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Error on getMessagesByChannel: ${errMessage}`);
    return [];
  }
}