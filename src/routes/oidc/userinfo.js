/*
 * userinfo endpoint called by the relying party
 */
import { getUserOIDCProfile } from '../../data/sql/User.js';
import { getUserRanks } from '../../data/redis/ranks.js';
import { getFishesOfUser } from '../../data/sql/Fish.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';
import { generatePPID } from '../../utils/hash.js';

import { USERLVL } from '../../core/constants.ts';

export default async (req, res) => {
  req.tickRateLimiter(500);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    Expires: '0',
  });

  const { oidcUserId: uid, oidcScope: scope, oidcClientId: clientId } = req;

  try {
    const payload = {};
    const userProfileModel = await getUserOIDCProfile(uid);
    if (!userProfileModel) {
      const error = new Error('Server experienced an error');
      error.title = 'server_error';
      error.status = 500;
      throw error;
    }
    while (scope.length) {
      switch (scope.pop()) {
        case 'openid': {
          payload.sub = generatePPID(clientId, String(uid));
          break;
        }
        case 'profile': {
          payload.name = userProfileModel.name;
          payload.preferred_username = userProfileModel.username;
          payload.updated_at = userProfileModel.createdAt;
          break;
        }
        case 'user_id': {
          const { userlvl } = userProfileModel;
          payload.user_lvl = userlvl;
          payload.verified = userlvl >= USERLVL.VERIFIED;
          payload.user_id = String(uid);
          break;
        }
        case 'email': {
          payload.email = userProfileModel.email;
          payload.email_verified = userProfileModel.verified;
          break;
        }
        case 'game_data': {
          // eslint-disable-next-line no-await-in-loop
          const ranks = await getUserRanks(uid);
          if (!ranks) {
            const error = new Error('Server experienced an error');
            error.title = 'server_error';
            error.status = 500;
            throw error;
          }
          const [totalPixels, dailyTotalPixels, ranking, dailyRanking] = ranks;
          payload.totalPixels = totalPixels;
          payload.dailyTotalPixels = dailyTotalPixels;
          payload.ranking = ranking;
          payload.dailyRanking = dailyRanking;
          break;
        }
        case 'achievements': {
          // eslint-disable-next-line no-await-in-loop
          const [fishes, badges] = await Promise.all([
            getFishesOfUser(uid),
            getBadgesOfUser(uid),
          ]);
          if (!fishes || !badges) {
            const error = new Error('Server experienced an error');
            error.title = 'server_error';
            error.status = 500;
            throw error;
          }
          payload.fishes = fishes;
          payload.badges = badges;
          break;
        }
        default:
         // nothing
      }
    }
    res.json(payload);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.title || 'invalid_request',
      error_description: err.message,
    });
  }
};
