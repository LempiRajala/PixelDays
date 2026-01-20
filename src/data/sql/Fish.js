import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { USER_FLAGS } from '../../core/constants.ts';

const Fish = sequelize.define('Fish', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  type: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  size: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function storeFish(uid, type, size) {
  try {
    await Fish.create({
      uid,
      type,
      size,
    });
  } catch (error) {
    console.error(`SQL Error on storeFish: ${error.message}`);
  }
}

/**
 * get information of single fish
 * @param id id of fish
 * @return fish { type, size, ts, caughtByUid, caughtByName } | null
 */
export async function getFishById(id) {
  try {
    const fish = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT f.type, f.size, f.createdAt,
f.uid AS caughtByUid, u.name AS caughtByName, u.username AS caughtByUsername,
(u.flags & ?) != 0 AS isPrivate FROM Fishes f
  LEFT JOIN Users u ON u.id = f.uid
WHERE f.id = ?`, {
        replacements: [0x01 << USER_FLAGS.PRIV, id],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (fish) {
      fish.ts = fish.createdAt.getTime();
      delete fish.createdAt;
      return fish;
    }
  } catch (error) {
    console.error(`SQL Error on getFish: ${error.message}`);
  }
  return null;
}

export async function getFishesOfUser(uid) {
  const fishes = [];
  try {
    const fishModels = await Fish.findAll({
      attributes: [
        'id',
        'type',
        'size',
        'createdAt',
      ],
      where: { uid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    let i = fishModels.length;
    while (i > 0) {
      i -= 1;
      const { id, type, size, createdAt } = fishModels[i];
      fishes.push({ id, type, size, ts: createdAt.getTime() });
    }
  } catch (error) {
    console.error(`SQL Error on getFishesOfUser: ${error.message}`);
  }
  return fishes;
}

export default Fish;
