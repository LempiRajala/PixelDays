import type { BaseReportSearchQuerySchema, CreateReportRequest, SearchReportsQuerySchema, UpdateReportRequest } from "../api-contracts";
import type { Report, User } from "../db/schema";
import { api } from "../utils/utag";

export const getReport = async (id: string): Promise<Report> => {
  const res = await fetch(api`/api/reports/${id}`, {
    credentials: 'include',
  });
  if(!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

export const updateReport = async (id: string, changes: UpdateReportRequest): Promise<void> => {
  const res = await fetch(api`/api/reports/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if(!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  return await res.json();
}

export const createReport = async (data: CreateReportRequest): Promise<Pick<Report, 'id'>> => {
  const res = await fetch(api`/api/reports`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if(!res.ok) {
    // throw new Error(`${res.status}: ${res.statusText}`);
    throw new Error(await res.text());
  }

  return await res.json();
}

const searchParamsToURLSearchParams = (query: SearchReportsQuerySchema | BaseReportSearchQuerySchema) => {
  const queryAsDict = query as Record<string, string | number>;
  const querySearchParams = new URLSearchParams();
  for(const prop in queryAsDict) {
    if(queryAsDict[prop] === undefined || queryAsDict[prop] === '') continue;
    querySearchParams.append(prop, encodeURIComponent(queryAsDict[prop]));
  }
  return querySearchParams;
}

export type SearchReportsResponse = (
  Report & {
    user: Pick<User, 'id' | 'avatarId' | 'username' | 'name' | 'flags'>;
  }
)[];

export const searchReports = async (
  query: SearchReportsQuerySchema,
  options?: Pick<RequestInit, 'signal'>,
): Promise<SearchReportsResponse> => {
  const querySearchParams = searchParamsToURLSearchParams(query);
  const res = await fetch(api`/api/reports/search?${querySearchParams.toString()}`, {
    credentials: 'include',
    ...options,
  });
  if(!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  const list = await res.json() as any[];
  return list.map(report => ({ ...report, createdAt: new Date(report.createdAt) }))
}

export type CountReportsResponse = { count: number };

export const countReports = async (
  query: BaseReportSearchQuerySchema,
  options?: Pick<RequestInit, 'signal'>,
): Promise<CountReportsResponse> => {
  const querySearchParams = searchParamsToURLSearchParams(query);
  const res = await fetch(api`/api/reports/count?${querySearchParams.toString()}`, {
    credentials: 'include',
    ...options,
  });
  if(!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }

  return await res.json();
}