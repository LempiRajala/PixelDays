import { z } from 'zod';
import { reportCategories, reportStatuses } from './db/shared.ts';

export const createReportSchema = z.object({
  text: z.string().min(1).max(2048),
  title: z.string().min(1).max(64),
  category: z.literal(reportCategories),
  telegram: z.string().max(32).optional(),
  discord: z.string().max(32).optional(),
}).strict();

export type CreateReportRequest = z.infer<typeof createReportSchema>;

export const updateReportSchema = z.object({
  category: z.literal(reportCategories).optional(),
  status: z.literal(reportStatuses).optional(),
}).strict();

export type UpdateReportRequest = z.infer<typeof updateReportSchema>;

export const baseReportSearchQuery = z.object({
  text: z.string().optional(),
  category: z.literal(reportCategories).optional(),
  status: z.literal(reportStatuses).optional(),
});

export type BaseReportSearchQuerySchema = z.infer<typeof baseReportSearchQuery>;

export const searchReportsQuerySchema = baseReportSearchQuery.extend({
  offset: z.coerce.number().int().min(0),
  limit: z.coerce.number().int().min(1),
});

export type SearchReportsQuerySchema = z.infer<typeof searchReportsQuerySchema>;