import { and, eq, gt, like, not, or, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "..";
import { type Report, reports, type InsertReport, users } from "../schema";
import type { BaseReportSearchQuerySchema, SearchReportsQuerySchema } from "../../api-contracts";

export const createReport = async (data: InsertReport) => {
  const created = await db
    .insert(reports)
    .values(data)
    .$returningId();
  return created[0];
}

export const updateReport = async (id: string, changes: Partial<Pick<Report, 'status' | 'category'>>) => {
  await db
    .update(reports)
    .set(changes)
    .where(eq(reports.id, id));
}

export const getReport = async (id: string) => {
  const list = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id));
  return list.at(0) ?? null;
}

const makeSearchConds = ({
  excludeModOrAdminAbuse,
  text,
  category,
  status,
}: BaseReportSearchQuerySchema & {
  excludeModOrAdminAbuse: boolean;
}) => {
  const conds: SQLWrapper[] = [];
  if(category !== undefined) {
    conds.push(eq(reports.category, category));
  }
  if(status !== undefined) {
    conds.push(eq(reports.status, status));
  }
  if(text && !!text.trim()) {
    conds.push(
      or(
        like(reports.title, `%${text}%`),
        like(reports.text, `%${text}%`),
        like(reports.discord, `%${text}%`),
        like(reports.telegram, `%${text}%`),
      )!
    );
  }
  if(excludeModOrAdminAbuse) {
    conds.push(not(eq(reports.category, 'moder-or-admin-abuse')));
  }
  return conds;
}

export const searchReports = async ({
  offset,
  limit,
  ...params
}: SearchReportsQuerySchema & {
  excludeModOrAdminAbuse: boolean;
}) => {
  const conds = makeSearchConds(params);
  const results = await db
    .select({
      id: reports.id,
      createdAt: reports.createdAt,
      text: reports.text,
      createdBy: reports.createdBy,
      telegram: reports.telegram,
      discord: reports.discord,
      title: reports.title,
      category: reports.category,
      status: reports.status,
      user: {
        id: users.id,
        avatarId: users.avatarId,
        username: users.username,
        name: users.name,
        flags: users.flags,
      },
    })
    .from(reports)
    .where(and(...conds))
    .limit(limit)
    .offset(offset)
    .orderBy(reports.createdAt)
    .leftJoin(users, eq(reports.createdBy, users.id));

  return results;
}

export const countReports = async (params: BaseReportSearchQuerySchema & {
  excludeModOrAdminAbuse: boolean;
}) => {
  const conds = makeSearchConds(params);
  const [{ count }] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(reports)
    .where(and(...conds));
  return count;
}

export const countReportsForLastTime = async ({
  userId,
  timePeriod,
}: {
  userId: number;
  timePeriod: number;
}) => {
  const [{ count }] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(reports)
    .where(
      and(
        eq(reports.createdBy, userId),
        gt(reports.createdAt, new Date(Date.now() - timePeriod))
      )
    );
  return count;
}