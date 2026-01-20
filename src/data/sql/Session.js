import { QueryTypes, DataTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { generateToken, generateTokenHash } from '../../utils/hash.js';
import { HOUR, CHANNEL_TYPES, USERLVL } from '../../core/constants.ts';
import { ADMIN_IDS } from '../../core/config.js';

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  token: {
    type: DataTypes.CHAR(38),
    allowNull: false,
    unique: 'token',
  },

  country: {
    type: DataTypes.CHAR(2),
    defaultValue: 'xx',
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * create session for a user
 * @param uid id of user
 * @param durationHours how long session is valid in hours or null for permanent
 * @param ip ip to store in the session
 * @return [
 *    null | token: session token,
 *   newLocation: boolean
 * ]
 */
export async function createSession(
  uid, durationHours, ip = null, device = null,
) {
  if (durationHours !== null && !durationHours) {
    /*
     * if we have a duration of 0, which would be a cookie that deletes on
     * browser close, we still store it for two days, cause we don't know when
     * a browser closes
     */
    durationHours = 48;
  }

  try {
    /*
     * make sure ip and device are parsed
     */
    const [deviceId] = await Promise.all([
      device?.getDeviceId(),
      ip?.getAllowance(),
    ]);
    /*
     * limit the amount of open sessions a user can have, and check if new
     * location
     */
    const openSessions = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT country FROM Sessions WHERE uid = $1 AND (expires > NOW() OR expires IS NULL)',
      { bind: [uid], type: QueryTypes.SELECT, raw: true },
    );
    let newLocation = false;
    if (openSessions.length > 0) {
      if (openSessions.length > 50) {
        await sequelize.query(
          `DELETE t FROM Sessions t JOIN (
    SELECT id FROM Sessions WHERE uid = :uid ORDER BY id ASC LIMIT 5
  ) AS oldest ON t.id = oldest.id`,
          { replacements: { uid }, raw: true, type: QueryTypes.DELETE },
        );
      }
      newLocation = !openSessions.some(({ country }) => country === ip.country);
    }

    const token = generateToken();
    // eslint-disable-next-line max-len
    const expires = durationHours && new Date(Date.now() + durationHours * HOUR);

    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Sessions (uid, token, expires, ip, country, did, createdAt) VALUES (?,?,?,IP_TO_BIN(?),?,?, NOW())', {
        replacements: [
          uid, generateTokenHash(token), expires,
          ip?.ipString, ip?.country || 'xx', deviceId,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return [token, newLocation];
  } catch (error) {
    console.error(`SQL Error on createSession: ${error.message}`);
  }
  return [null, false];
}

/**
 * remove session
 * @param token
 * @return boolean success
 */
export async function removeSession(token) {
  if (!token) {
    return false;
  }
  try {
    const count = await Session.destroy({
      where: { token: generateTokenHash(token) },
    });
    return count !== 0;
  } catch (error) {
    console.error(`SQL Error on removeSession: ${error.message}`);
  }
  return false;
}

/**
 * remove session by id
 * @param id session id
 * @param uid user id
 * @return boolean success
 */
export async function removeSessionById(id, uid) {
  if (!id) {
    return false;
  }
  try {
    const count = await Session.destroy({
      where: { id, uid },
    });
    return count !== 0;
  } catch (error) {
    console.error(`SQL Error on removeSessionById: ${error.message}`);
  }
  return false;
}

/**
 * resolve only uid of session of given token
 * @param token
 * @return uid: number | null
 */
export async function resolveSessionUid(token) {
  if (!token) {
    return null;
  }
  try {
    const session = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT uid FROM Sessions WHERE token = ? AND (expires > NOW() OR expires IS NULL)', {
        replacements: [generateTokenHash(token)],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (session) {
      return session.uid;
    }
  } catch (error) {
    console.error(`SQL Error on resolveSessionUid: ${error.message}`);
  }
  return null;
}

/**
 * resolve uid and age of session of given token in seconds
 * Additionally return if a user is valid for oauth login, which currently
 * only means that a username must be set.
 * @param token
 * @return [uid: number | null, age: number | null, isValid: boolean]
 */
export async function resolveSessionUidAndAge(token) {
  if (!token) {
    return [null, null];
  }
  try {
    const session = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT s.uid, s.createdAt, u.username NOT LIKE 'pp\\_%' AS isValid FROM Sessions s
  INNER JOIN Users u ON u.id = s.uid
WHERE token = ? AND (expires > NOW() OR expires IS NULL)`, {
        replacements: [generateTokenHash(token)],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (session) {
      return [
        session.uid,
        Math.floor(session.createdAt.getTime() / 1000),
        !!session.isValid,
      ];
    }
  } catch (error) {
    console.error(`SQL Error on resolveSessionUidAndAge: ${error.message}`);
  }
  return [null, null];
}

/**
 * resolve a session for a given token
 * @param token
 * @return null | {
 *   id,
 *   name,
 *   password,
 *   userlvl,
 *   flags,
 *   lastSeen,
 *   createdAt,
 *   blocked: [ { id, name }, ...],
 *   bans: [ { expires, flags }, ... ],
 *   channels: {
 *     cid: [ name, type, lastTs, [dmuid] ],
 *     ...
 *   },
 * }
 */
export async function resolveSession(token) {
  if (!token) {
    return null;
  }
  try {
    /*
     * CURRENT STATUS:
     * Resolving a session takes two round-trip-times of:
     *  1 + 3 queries if User has any DM chat channels associated
     *  1 + 2 queries otherwise
     * Consider that in api/me we also get redis ranks after resolving session,
     * making a api/me call have three round-trips.
     * Resolving IP intel (whois, proxycheck) is in parallel to resolving the
     * session and takes longer than two sql round-trips if it has to be
     * fetched. Therefore session resolving isn't the largest issue in case of
     * a DDoS with unique IPs.
     */

    /* eslint-disable max-len */

    let user = await sequelize.query(
      `SELECT u.id, u.name, u.avatarId, u.bannerId, u.username, u.password, u.userlvl, u.flags, u.lastSeen, u.createdAt,
c.id AS 'channels.cid', c.name AS 'channels.name', c.\`type\` AS 'channels.type', c.lastMessage AS 'channels.lastDate', ucm.lastRead AS 'channels.lastReadDate' FROM Users u
  INNER JOIN Sessions s ON s.uid = u.id
  LEFT JOIN UserChannels ucm ON ucm.uid = u.id
  LEFT JOIN Channels c ON c.id = ucm.cid
WHERE s.token = $1 AND (s.expires > NOW() OR s.expires IS NULL)`, {
        bind: [generateTokenHash(token)],
        raw: true,
        type: QueryTypes.SELECT,
      });
    /*
     * {
     *   id, name, password, userlvl, flags, lastSeen, createdAt,
     *   channels: [{
     *     cid, name, type, lastDate,
     *   }, ...]
     * }
     */
    user = nestQuery(user);

    if (!user) {
      return null;
    }
    const promises = [];
    const userId = user.id;

    /* set ADMIN */
    if (ADMIN_IDS.includes(userId)) {
      user.userlvl = USERLVL.ADMIN;
    }

    /* get info to DM channels */
    const dmChannelIds = user.channels.filter(
      ({ type }) => type === CHANNEL_TYPES.DM,
    ).map(({ cid }) => cid);
    if (dmChannelIds.length) {
      promises.push(sequelize.query(
        `SELECT uc.cid, dmu.id AS 'dmuid', dmu.name AS 'dmname' FROM UserChannels uc
    INNER JOIN Users dmu ON dmu.id = uc.uid
  WHERE dmu.id != ? AND uc.cid IN (?)`, {
          replacements: [userId, dmChannelIds],
          raw: true,
          type: QueryTypes.SELECT,
        }));
    } else {
      promises.push([]);
    }

    /* get blocked users */
    promises.push(sequelize.query(
      `SELECT bu.id, bu.name FROM UserBlocks ub
  INNER JOIN Users bu ON bu.id = ub.buid
WHERE ub.uid = ?`, {
        replacements: [userId],
        raw: true,
        type: QueryTypes.SELECT,
      }));

    /* get bans applying on user id or tpid */
    promises.push(sequelize.query(
      `SELECT b.expires, b.flags FROM Bans b WHERE b.id IN (
  SELECT DISTINCT b.id FROM (
    SELECT ub.bid AS id FROM UserBans ub WHERE ub.uid = ?
    UNION ALL
    SELECT tb.bid AS id FROM ThreePIDBans tb INNER JOIN ThreePIDs t ON tb.tid = t.id WHERE t.uid = ?
  ) AS b
) AND (b.expires > NOW() OR b.expires IS NULL)`, {
        replacements: [userId, userId],
        raw: true,
        type: QueryTypes.SELECT,
      }));

    /* eslint-enable max-len */

    const [dmChannels, blocked, bans] = await Promise.all(promises);

    /*
     * dmChannels:
     *   [{ cid, dmuid, dmname }, ...]
     * user.channels:
     *   [{ cid, name, type, lastDate, lastReadDate }, ...]
     * target user.channels:
     *   { cid: [ name, type, lastTs, [dmuid]], ... }
     */
    if (user.channels.length) {
      const { channels } = user;
      user.channels = {};
      let i = channels.length;
      while (i > 0) {
        i -= 1;
        const { cid, name, type, lastDate } = channels[i];
        const channel = [name, type, lastDate.getTime()];
        if (type === CHANNEL_TYPES.DM) {
          const dmChannel = dmChannels.find(({ cid: dmcid }) => dmcid === cid);
          if (!dmChannel) {
            console.error(
              // eslint-disable-next-line max-len
              `Session Error: User ${userId} has DM channel ${cid} but no other use associated`,
            );
            continue;
          }
          const { dmuid, dmname } = dmChannel;
          channel.push(dmuid);
          channel[0] = dmname;
        }
        user.channels[cid] = channel;
      }
    }

    /*
     * [{ id, name }]
     */
    user.blocked = blocked;

    /*
     * [{ expires, flags }]
     */
    user.bans = bans;

    return user;
  } catch (error) {
    console.error(`SQL Error on resolveSession: ${error.message}`);
  }
  return null;
}

/**
 * get all Sessions for a User
 * @param userId
 * @return [{
 *   id: session id,
 *   token: session token,
 *   country,
 *   os,
 *   browser,
 * }, ...]
 */
export async function getAllSessionsOfUser(userId) {
  if (userId) {
    try {
      return await sequelize.query(
        `SELECT s.id, s.token, s.country, d.os, d.browser FROM Sessions s
    LEFT JOIN Devices d ON d.id = s.did
  WHERE s.uid = ? AND (s.expires > NOW() OR s.expires IS NULL)`,
        { replacements: [userId], type: QueryTypes.SELECT, raw: true },
      );
    } catch (error) {
      console.error(`SQL Error on getAllSessionsOfUser: ${error.message}`);
    }
  }
  return [];
}

export default Session;
