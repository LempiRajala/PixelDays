/**
 *
 * Storing third party IDs for oauth login
 */

import Sequelize, { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import ThreePIDHistory from './ThreePIDHistory.js';
import ThreePIDBan from './association_models/ThreePIDBan.js';

import { THREEPID_PROVIDERS } from '../../core/constants.ts';

export { THREEPID_PROVIDERS };

const ThreePID = sequelize.define('ThreePID', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  provider: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  tpid: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },

  normalizedTpid: {
    /*
     * this is NORMALIZE_TPID function inlined, which removes . and +string
     * from emails.
     * We can't use the function itself, cause generated columns do not allow
     * that.
     */
    // eslint-disable-next-line max-len
    type: 'VARCHAR(80) GENERATED ALWAYS AS (CASE WHEN provider != 1 THEN NULL WHEN LOCATE(\'@\', tpid) = 0 THEN NULL ELSE LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(tpid, \'@\', 1), \'+\', 1), \'.\', \'\'),\'@\',(SUBSTRING_INDEX(tpid, \'@\', -1)))) END) STORED',
  },

  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    name: 'ptpid',
    fields: ['provider', 'tpid'],
  }, {
    unique: true,
    name: 'pntpid',
    fields: ['provider', 'normalizedTpid'],
  }],
});

/**
 * upsert a tpid
 * @param uid user id
 * @param provider THREEPID_PROVIDERS
 * @param tpid threepid string
 * @param verified whether or not verified
 * @return boolean success
 */
export async function addOrReplaceTpid(uid, provider, tpid, verified = null) {
  try {
    const query = { uid, provider, tpid, lastSeen: Date.now() };
    if (verified) query.verified = true;

    await ThreePID.upsert(query, { returning: false });
  } catch (error) {
    console.error(`SQL Error on addOrReplaceTpid: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * remove a tpid from a user
 * @param uid user id
 * @param id tpid id
 * @return boolean success
 */
export async function removeTpidFromUser(uid, id) {
  const transaction = await sequelize.transaction();

  try {
    const [tpid, isBanned] = await Promise.all([
      ThreePID.findByPk(id, { raw: true, transaction }),
      ThreePIDBan.count({ where: { tid: id }, transaction }),
    ]);

    const promises = [];
    if (isBanned === 0) {
      promises.push(ThreePID.destroy({
        where: { id },
        transaction,
      }));
    } else {
      /* keep around if banned */
      promises.push(
        ThreePID.update({ uid: null }, { where: { id }, transaction }),
      );
    }

    /* store in history */
    promises.push(ThreePIDHistory.create({
      uid: tpid.uid,
      provider: tpid.provider,
      tpid: tpid.tpid,
      normalizedTpid: tpid.normalizedTpid,
      verified: tpid.verified,
      lastSeen: new Date(),
      createdAt: tpid.createdAt,
    }, { transaction }));

    await Promise.all(promises);
    await transaction.commit();
  } catch (error) {
    console.error(`SQL Error on removeTpidFromUser: ${error.message}`);
    await transaction.rollback();
    throw error;
  }
}

/**
 * get email of a user, it will only return one, even if there could
 * be multiple
 * @param uid
 * @return null if none exists | false if error | email otherwise
 */
export async function getEmailOfUser(uid) {
  try {
    const tpid = await ThreePID.findOne({
      attributes: ['tpid'],
      where: {
        uid,
        provider: THREEPID_PROVIDERS.EMAIL,
      },
      raw: true,
    });
    return tpid?.tpid || false;
  } catch (error) {
    console.error(`SQL Error on getEmailOfUser: ${error.message}`);
  }
  return null;
}

/**
 * get all ThreePIDs of user
 * @param uid user id
 * @return Promise<[{
 *   id, tpid, provider, verified },
 *   ...
 * ]>
 */
export function getTPIDsOfUser(uid) {
  return sequelize.query(
    'SELECT id, tpid, provider, verified FROM ThreePIDs WHERE uid = ?', {
      replacements: [uid],
      raw: true,
      type: QueryTypes.SELECT,
    },
  );
}

/**
 * get histry of ThreePIDs of user
 * @param uid user id
 * @return Promise<[{
 *   tpid, normalizedTpid, provider, verified, lastSeen, createdAt },
 *   ...
 * ]>
 */
export function getTPIDHistoryOfUser(uid) {
  return sequelize.query(
    // eslint-disable-next-line max-len
    'SELECT id, tpid, provider, verified, lastSeen FROM ThreePIDHistories WHERE uid = ?', {
      replacements: [uid],
      raw: true,
      type: QueryTypes.SELECT,
    },
  );
}

/**
 * set email of user
 * @param uid user id
 * @param email email string
 * @param verified whether or not the email got verified
 * @param return boolean if email got set, null if email already exists for
 *   different user
 */
export async function setEmail(uid, email, verified = false) {
  try {
    const [existingEmail, existingUserEmail] = await Promise.all([
      ThreePID.findOne({
        attributes: ['id', 'uid'],
        where: {
          provider: THREEPID_PROVIDERS.EMAIL,
          normalizedTpid: Sequelize.fn(
            'NORMALIZE_TPID', THREEPID_PROVIDERS.EMAIL, email,
          ),
        },
        raw: true,
      }),
      ThreePID.findOne({
        where: {
          uid,
          provider: THREEPID_PROVIDERS.EMAIL,
        },
        raw: true,
      }),
    ]);

    if (existingEmail) {
      if (existingEmail.uid === uid) {
        /* user already has that mail */
        return true;
      } if (existingEmail.uid === null) {
        /* threepid exists, but without user */
        await ThreePID.update({ uid, verified: false },
          { where: { id: existingEmail.id } },
        );
      } else {
        return false;
      }
    } else {
      /* fresh tpid */
      await ThreePID.create({
        uid,
        verified,
        provider: THREEPID_PROVIDERS.EMAIL,
        tpid: email,
      });
    }
    /* remove previous email */
    if (existingUserEmail) {
      await removeTpidFromUser(uid, existingUserEmail.id);
    }
  } catch (error) {
    console.error(`SQL Error on setEmail: ${error.message}`);
    throw error;
  }
  return true;
}

export default ThreePID;
