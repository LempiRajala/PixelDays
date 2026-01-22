import type { UnmarshalledUser } from '../db/schema.js';
import { api } from '../utils/utag.js'

export interface UserInfoResponse extends Pick<
  UnmarshalledUser,
  'id'
  | 'avatarId'
  | 'bannerId'
  | 'username'
  | 'name'
  | 'flags'
  | 'lastSeen'
  | 'createdAt'
> {
  totalPixels?: number;
  dailyTotalPixels?: number;
  ranking?: number;
  dailyRanking?: number;
}

export const getUserInfo = async (id: number, options?: Pick<RequestInit, 'signal'>): Promise<UserInfoResponse> => {
  const res = await fetch(api`/api/user-info/${id}`, options);
  if(!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }

  const parsed = await res.json();
  return {
    ...parsed,
    lastSeen: new Date(parsed.lastSeen),
    createdAt: new Date(parsed.createdAt),
  }
}