import type { Request, Response } from 'express';
import { getUser } from '../../db/utils/users.ts';
import { pick } from 'lodash';
import { getUserRanks } from '../../data/redis/ranks.js';

export default async (req: Request, res: Response) => {
  //@ts-expect-error
  req.tickRateLimiter(3000);

  const rawUserId = req.params.id;
  if(Array.isArray(rawUserId)) {
    return res.status(400);
  }
  const userId = +rawUserId;

  const userInfo = await getUser(userId);
  if(!userInfo) {
    return res.status(404);
  }

  const safeUserInfo = pick(userInfo, ['id', 'avatarId', 'bannerId', 'username', 'name', 'flags', 'lastSeen', 'createdAt']);

  const ranks = await getUserRanks(userId);

  return res
    .status(200)
    .send(
      ranks
      ? {
          ...safeUserInfo,
          totalPixels: ranks[0],
          dailyTotalPixels: ranks[1],
          ranking: ranks[2],
          dailyRanking: ranks[3],
        }
      : safeUserInfo
    );
};