import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { USER_FLAGS } from '../../core/constants.ts';

const Badge = sequelize.define('Badge', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(32)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'name',
  },

  description: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
  },
});

/**
 * get information of a speciic badge
 * @param id id of badge from UserBadges table
 */
export async function getBadgeById(id) {
  try {
    const badge = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT b.name, b.description, ub.note,
ub.createdAt, u.id AS userId, u.name AS userDisplayName, u.username AS userName,
(u.flags & ?) != 0 AS isPrivate FROM Badges b
  INNER JOIN UserBadges ub ON ub.bid = b.id
  INNER JOIN Users u ON u.id = ub.uid
WHERE ub.id = ?`, {
        replacements: [0x01 << USER_FLAGS.PRIV, id],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (badge) {
      badge.ts = badge.createdAt.getTime();
      delete badge.createdAt;
      return badge;
    }
  } catch (error) {
    console.error(`SQL Error on getFish: ${error.message}`);
  }
  return null;
}

/**
 * get all badges of a user
 * @param uid user id
 * @return [{
 *   id: id of badge from UserBadges table
 *   name: name of badge, which is also used in the filename
 *   description: descriptive text
 * }, ...]
 */
export async function getBadgesOfUser(uid) {
  const badges = [];
  try {
    const results = await sequelize.query(
      `SELECT ub.id, b.name, b.description, ub.createdAt FROM Badges b
  INNER JOIN UserBadges ub ON ub.bid = b.id
  INNER JOIN Users u ON u.id = ub.uid
WHERE u.id = ?`, {
        replacements: [uid],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    let i = results.length;
    while (i > 0) {
      i -= 1;
      const { id, name, description, createdAt } = results[i];
      badges.push({ id, name, description, ts: createdAt.getTime() });
    }
  } catch (error) {
    console.error(`SQL Error on getBadgesOfUser: ${error.message}`);
  }
  return badges;
}

/**
 * ensure that a badge exists
 */
export async function ensureBadgeExistence(name, description) {
  try {
    const found = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT description FROM Badges WHERE name = ?', {
        replacements: [name],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (found) {
      if (found.description !== description) {
        await sequelize.query(
          'UPDATE Badges SET description = ? WHERE name = ?', {
            replacements: [description, name],
            raw: true,
            type: QueryTypes.UPDATE,
          },
        );
      }
      return true;
    }
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Badges (name, description) VALUES (?, ?)', {
        replacements: [name, description],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on ensureBadgeExistence: ${error.message}`);
  }
  return false;
}

export default Badge;
