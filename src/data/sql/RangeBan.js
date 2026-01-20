import { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import RangeBanHistory from './RangeBanHistory.js';

export { RANGEBAN_REASONS } from '../../core/constants.ts';

const RangeBan = sequelize.define('RangeBan', {
  rid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },

  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
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
 * Lift multiple IP Range Bans
 * @param bans Array of Ban model instances
 * @param [modUid] user id of mod that lifted the bans
 */
async function removeRangeBans(bans, modUid) {
  if (!bans.length) {
    return;
  }
  const transaction = await sequelize.transaction();
  try {
    if (modUid) {
      await RangeBanHistory.bulkCreate(bans.map((ban) => ({
        rid: ban.rid,
        reason: ban.reason,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        liftedAt: null,
      })), {
        transaction,
      });
    } else {
      await RangeBanHistory.bulkCreate(bans.map((ban) => ({
        rid: ban.rid,
        reason: ban.reason,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        lmuid: modUid,
      })), {
        transaction,
      });
    }

    await RangeBan.destroy({
      where: { rid: bans.map((b) => b.rid) },
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/*
 * clean expired range bans
 */
export async function cleanRangeBans() {
  try {
    const expiredBans = await RangeBan.findAll({
      attributes: ['reason', 'expires', 'createdAt', 'muid', 'rid'],
      where: {
        expires: { [Op.lte]: new Date() },
      },
      raw: true,
    });

    if (!expiredBans.length) {
      return 0;
    }
    await removeRangeBans(expiredBans);
    return expiredBans.length;
  } catch (error) {
    console.error(`SQL Error on cleanIPRangeBans: ${error.message}`);
    return null;
  }
}
// HourlyCron.hook(cleanIPRangeBans);

export default RangeBan;
