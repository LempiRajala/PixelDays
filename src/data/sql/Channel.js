/*
 *
 * Database layout for Chat Channels
 *
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import UserChannel from './association_models/UserChannel.js';

import { CHANNEL_TYPES } from '../../core/constants.ts';

export { CHANNEL_TYPES };

const Channel = sequelize.define('Channel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: true,
    set(value) {
      this.setDataValue('name', value.slice(0, 32));
    },
  },

  type: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  lastMessage: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * add a user to a channel
 * @param uid user id
 * @param cid channel id
 * @return boolean success
 */
export async function addUserToChannel(uid, cid) {
  try {
    const [, created] = await UserChannel.findOrCreate({
      where: { uid, cid },
      raw: true,
    });
    return created;
  } catch (error) {
    console.error(`SQL Error on addUserToChannel: ${error.message}`);
  }
  return false;
}

/**
 * find DM channel between users
 * @param uidA user id of user A
 * @param uidB user id of user B
 * @return channel id of DM channel or null if none exists
 */
export async function findDMChannel(uidA, uidB) {
  if (!uidA || !uidB) {
    return null;
  }
  try {
    const channel = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT c.id FROM Channels c
  INNER JOIN UserChannels uc ON c.id = uc.cid
WHERE c.type = ? AND uc.uid IN (?, ?) GROUP BY c.id HAVING COUNT(DISTINCT uc.uid) = 2`, {
        /* eslint-disable max-len */
        replacements: [CHANNEL_TYPES.DM, uidA, uidB],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    return channel[0]?.id;
  } catch (error) {
    console.error(`SQL Error on findDMChannel: ${error.message}`);
  }
  return null;
}

/**
 * create DM between two users
 * @param uidA user id of user A
 * @param uidB user id of user B
 * @return [cid, created] cid can be set and created false if DM channel
 *   already exists
 */
export async function createDMChannel(uidA, uidB) {
  let cid = await findDMChannel(uidA, uidB);
  if (cid) {
    return [cid, false];
  }
  const transaction = await sequelize.transaction();

  try {
    const channel = await Channel.create({
      type: CHANNEL_TYPES.DM,
    }, { transaction });
    cid = channel.id;
    await UserChannel.bulkCreate([
      { uid: uidA, cid }, { uid: uidB, cid },
    ], { transaction });

    await transaction.commit();
    return [cid, true];
  } catch (error) {
    await transaction.rollback();
    console.error(`SQL Error on createDMChannel: ${error.message}`);
    throw error;
  }
}

/**
 * delete dem channel between users if one exists
 * @param uidA user id of user A
 * @param uidB user id of user B
 * @return channelId if success, null if not
 */
export async function deleteDMChannel(uidA, uidB) {
  try {
    const channelId = await findDMChannel(uidA, uidB);
    if (channelId) {
      await Channel.destroy({ where: { id: channelId } });
      return channelId;
    }
  } catch (error) {
    console.error(`SQL Error on deleteDMChannel: ${error.message}`);
  }
  return null;
}

/**
 * delete channel
 * @param id channel id
 * @return boolean if successful
 */
export async function deleteChannel(id) {
  try {
    const rows = await Channel.destroy({ where: { id } });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on deleteChannel: ${error.message}`);
  }
  return false;
}

/**
 * get amount of users in a channel
 * @param cid channel id
 * @return number | null
 */
export async function amountOfUsersInChannel(cid) {
  try {
    const rows = await UserChannel.count({ where: { cid } });
    return rows;
  } catch (error) {
    console.error(`SQL Error on amountOfUsersInChannel: ${error.message}`);
  }
  return null;
}

/**
 * remove a user from a channel
 * @param uid user id
 * @param cuid channel id
 * @return boolean success
 */
export async function removeUserFromChannel(uid, cid) {
  try {
    const rows = await UserChannel.destroy({ where: { uid, cid } });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on removeUserFromChannel: ${error.message}`);
  }
  return false;
}


/**
 * delete all DM channels belonging to a user
 * @param uid user id
 * @return [{ cid, uidA, uidB }, ...] destroyed channels
 */
export async function deleteAllDMChannelsOfUser(uid) {
  try {
    /* [{ dmuid, cid }, ...] */
    const dmChannels = await sequelize.query(
      `SELECT uc.uid AS 'dmuid', uc.cid FROM UserChannels uc
WHERE uc.cid IN (
  SELECT DISTINCT c.id FROM Channels c
    INNER JOIN UserChannels uci ON uci.cid = c.id
  WHERE c.type = ? AND uci.uid = ?
) AND uc.uid != ?`, {
        replacements: [CHANNEL_TYPES.DM, uid, uid],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    if (dmChannels.length) {
      await Channel.destroy({ where: { id: dmChannels.map((r) => r.cid) } });
    }
    return dmChannels;
  } catch (error) {
    console.error(`SQL Error on deleteAllDMChannelsOfUser: ${error.message}`);
    return null;
  }
}

/**
 * find or create a default channel
 * @param name name of channel
 */
export function getDefaultChannel(name) {
  return Channel.findOrCreate({
    where: { name, type: CHANNEL_TYPES.PUBLIC },
    raw: true,
  });
}

export default Channel;
