/*
 *
 * returns chat messages of given channel
 *
 */
import chatProvider from '../../core/ChatProvider.js';
import { UsersAvatarsCache } from './users-avatars-cache.ts';

async function chatHistory(req, res) {
  req.tickRateLimiter(1000);

  let { cid, limit } = req.query;

  if (!cid || !limit) {
    res.status(400);
    res.json({
      errors: ['cid or limit not defined'],
    });
    return;
  }
  cid = parseInt(cid, 10);
  limit = parseInt(limit, 10);
  if (Number.isNaN(cid) || Number.isNaN(limit)
    || limit <= 0 || limit > 200) {
    res.status(400);
    res.json({
      errors: ['cid or limit not a valid value'],
    });
    return;
  }

  if (!chatProvider.userHasChannelAccess(req.user, req.lang, cid)) {
    res.status(401);
    res.json({
      errors: ['You don\'t have access to this channel'],
    });
    return;
  }

  const history = await chatProvider.getHistory(cid, limit);
  const usersIds = Array.from(new Set(history.map(msg => msg[3])));
  const userIdToAvatarId = Object.fromEntries(
    await Promise.all(
      usersIds.map(async userId => {
        const { avatarId } = await UsersAvatarsCache.get(userId);
        return [userId, avatarId];
      })
    )
  );
  res.json({
    history,
    userIdToAvatarId,
  });
}

export default chatHistory;
