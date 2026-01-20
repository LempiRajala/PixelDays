/**
 *
 * This is the database of the data for registered Users
 *
 */

import { randomUUID } from 'crypto';
import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { generateHash } from '../../utils/hash.js';
import { setEmail } from './ThreePID.js';
import {
  USERLVL, THREEPID_PROVIDERS, USER_FLAGS,
} from '../../core/constants.ts';
import { deleteAllDMChannelsOfUser } from './Channel.js';

export { USERLVL, THREEPID_PROVIDERS, USER_FLAGS };


const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /* [a-zA-Z0-9._-] */
  username: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(32)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'username',
  },

  // STRING is VARCHAR
  name: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    unique: 'name',
  },

  // avatarId: {
  //   type: `${DataTypes.UUIDV4} CHARSET ascii COLLATE ascii_bin`,
  //   allowNull: false,
  // },

  // null if only ever used external oauth
  password: {
    type: DataTypes.CHAR(60),
    set(value) {
      if (value) this.setDataValue('password', generateHash(value));
    },
  },

  userlvl: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: USERLVL.REGISTERED,
  },

  /*
   * from lowest to highest bit, see USER_FLAGS:
   * 0: blockDm (if account blocks all DMs)
   * 1: priv (if account is private)
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
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
});

/*
 * Set default username to pp_[id],
 * since we allow third party login, we can not ensure to have good names
 * available.
 * We will allow the user to change it ONCE at a later point, if his name
 * starts with pp_.
 * NOTE: This trigger doesn't like bulk inserts!
 */
User.afterSync(async () => {
  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS set_username
BEFORE INSERT ON Users FOR EACH ROW
BEGIN
  IF NEW.username IS NULL OR NEW.username = '=' THEN
    SET NEW.username = CONCAT('pp_', (
      SELECT AUTO_INCREMENT FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Users' AND TABLE_SCHEMA = DATABASE()
    ));
  ELSE
    SET NEW.username = REGEXP_REPLACE(NEW.username, '[^a-zA-Z0-9._-]', '');
  END IF;
END`);
});

/**
 * update lastSeen timestamps of User
 * @param id user id
 * @param ipString ip as string
 */
export async function touchUser(id, ipString) {
  try {
    await User.update({ lastSeen: Sequelize.fn('NOW') }, {
      where: { id },
    });
    if (ipString) {
      await sequelize.query(
        // eslint-disable-next-line max-len
        'INSERT INTO UserIPs (lastSeen, ip, uid) VALUES (NOW(), IP_TO_BIN($1), $2) ON DUPLICATE KEY UPDATE lastSeen = VALUES(lastSeen)', {
          bind: [ipString, id],
          raw: true,
          type: QueryTypes.INSERT,
        },
      );
    }
  } catch (error) {
    console.error(
      `SQL Error on touchUser ${id}, ${ipString}: ${error.message}`,
    );
  }
}

/**
 * find or create a dummmy user. This is used for bot users.
 * @param name name of user
 */
export async function getDummyUser(name) {
  const dummy = await User.findOrCreate({
    attributes: ['id'],
    where: { name },
    defaults: {
      name,
      username: '=',
      userlvl: USERLVL.VERIFIED,
    },
    raw: true,
  });
  return dummy[0].id;
}

/**
 * get basic userinfo by username or id
 * @param username or id
 * @return {
 *   uid, name, country, userlvl, isMuted,
 * }
 */
export async function getInfoByUsernameOrId(usernameOrId) {
  if (!usernameOrId) {
    return null;
  }
  try {
    /* eslint-disable max-len */
    let query = `SELECT u.id AS uid, u.name, s.country, u.userlvl,
 EXISTS(SELECT 1 FROM Bans b INNER JOIN UserBans ub ON ub.bid = b.id WHERE ub.uid = u.id AND (b.flags & 0x02) > 0 AND (b.expires > NOW() OR b.expires IS NULL)) AS isMuted
 FROM Users u
    LEFT JOIN Sessions s ON s.uid = u.id AND s.country != 'xx'
WHERE `;
    /* eslint-enable max-len */
    if (Number.isInteger(usernameOrId)) {
      query += 'u.id = ?';
    } else {
      query += 'u.username = ?';
    }
    return await sequelize.query(query, {
      replacements: [usernameOrId], type: QueryTypes.SELECT, plain: true,
    },
    );
  } catch (error) {
    console.error(`SQL Error on getInfoByUsername: ${error.message}`);
  }
  return null;
}

export async function name2Id(name) {
  try {
    const userq = await sequelize.query(
      'SELECT id FROM Users WHERE name = ?',
      { replacements: [name], type: QueryTypes.SELECT, plain: true },
    );
    return userq.id;
  } catch {
    return null;
  }
}

export async function id2Name(id) {
  const user = await User.findByPk(id, {
    attributes: ['name'],
    raw: true,
  });
  if (user) {
    return user.name;
  }
  return null;
}

export async function findIdByNameOrId(searchString) {
  let id;
  if (!Number.isNaN(Number(searchString))) {
    id = parseInt(searchString, 10);
    const name = await id2Name(id);
    if (name) {
      return { name, id };
    }
  }

  id = await name2Id(searchString);
  if (id) {
    return { name: searchString, id };
  }
  return null;
}

export async function getNamesToIds(ids) {
  const idToNameMap = new Map();
  if (!ids.length) {
    return idToNameMap;
  }
  try {
    const result = await User.findAll({
      attributes: ['id', 'name'],
      where: {
        id: ids,
      },
      raw: true,
    });
    result.forEach((obj) => {
      idToNameMap.set(obj.id, obj.name);
    });
  } catch {
    // nothing
  }
  return idToNameMap;
}

/**
 * get User by id
 * @param id user id
 * @return { id, name, username, password, flags, userlvl }
 */
export async function findUserById(id) {
  if (!id) {
    return null;
  }
  try {
    return await User.findByPk(id, {
      attributes: ['id', 'name', 'username', 'password', 'flags', 'userlvl'],
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on findUserById: ${error.message}`);
  }
  return null;
}

/**
 * get User ids of all users with nameOrEmails
 * @param nameIdsOrEmails Array or singular name or email or id
 * @return Array of ids
 */
export async function getUserIdsByNamesOrEmails(nameIdsOrEmails) {
  const ids = [];
  if (!nameIdsOrEmails) {
    return ids;
  }
  if (!Array.isArray(nameIdsOrEmails)) {
    nameIdsOrEmails = [nameIdsOrEmails];
  }
  /* if there are already ids in nameOrEmails, pass them through */
  const nameOrEmails = [];
  for (let i = 0; i < nameIdsOrEmails.length; i += 1) {
    const n = nameIdsOrEmails[i];
    const id = parseInt(n, 10);
    if (Number.isNaN(id)) {
      nameOrEmails.push(n);
    } else {
      ids.push(id);
    }
  }

  try {
    /* eslint-disable max-len */
    const where = [];
    const replacements = [];
    if (nameOrEmails.length) {
      where.push(
        'u.name IN (?)',
        `u.username IN (SELECT l.username FROM (${
          nameOrEmails.map(() => 'SELECT CONVERT(? USING ascii) AS \'usename\'').join(' UNION ALL ')
        }) AS l)`,
        'EXISTS (SELECT 1 FROM ThreePIDs t WHERE t.uid = u.id AND t.tpid IN (?) AND t.provider = ?)',
      );
      replacements.push(nameOrEmails, ...nameOrEmails, nameOrEmails, THREEPID_PROVIDERS.EMAIL);
    }

    let users = [];
    if (where.length) {
      users = await sequelize.query(
        `SELECT u.id FROM Users u WHERE ${where.join(' OR ')}`, {
          replacements,
          raw: true,
          type: QueryTypes.SELECT,
        },
      );
    }
    /* eslint-enable max-len */

    return ids.concat(users.map((i) => i.id));
  } catch (error) {
    console.error(`SQL Error on getUserIdsByNamesOrEmails: ${error.message}`);
  }
  return ids;
}

/**
 * people tend to get their credentials leaked, reset them to the oldest
 * email available and mark their password as 'hacked'
 * @param nameIdsOrEmails Array or singular name or email or id
 * @return [emailSet, mailExists] Arrays of UserIds that we could set mails for
 *   or not. If not, it only means that that mail is still assigned to the user
 */
export async function markUserAccountsAsHacked(nameIdsOrEmails) {
  const emailSet = [];
  const mailExists = [];
  const affectedIds = await getUserIdsByNamesOrEmails(nameIdsOrEmails);
  if (!affectedIds.length) {
    return [emailSet, mailExists];
  }
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < affectedIds.length; i += 1) {
    const id = affectedIds[i];
    const oldestEmail = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT tpid, verified FROM ThreePIDHistories WHERE provider = 1 AND uid = ? ORDER BY createdAt ASC LIMIT 1', {
        replacements: [id],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    let couldSetMail;
    if (oldestEmail.length) {
      /* set user to oldest email */
      couldSetMail = await setEmail(
        id, oldestEmail[0].tpid, oldestEmail[0].verified,
      );
    }
    const promises = [];
    /* set password to 'hacked' */
    promises.push(sequelize.query(
      // eslint-disable-next-line max-len
      'UPDATE Users SET password = \'hacked\' WHERE id = ? AND password IS NOT NULL', {
        replacements: [id],
        raw: true,
        type: QueryTypes.UPDATE,
      }));
    /* clear all user sessions */
    promises.push(sequelize.query(
      'DELETE t FROM Sessions t WHERE uid = ?', {
        replacements: [id],
        raw: true,
        type: QueryTypes.DELETE,
      }));

    await Promise.all(promises);
    if (couldSetMail) {
      emailSet.push(id);
    } else {
      mailExists.push(id);
    }
  }
  /* eslint-enable no-await-in-loop */
  return [emailSet, mailExists];
}

/**
 * get User by id or name
 * @param id user id
 * @param name user name
 * @return [{ id, name, password, userlvl }, ... ]
 */
export async function findUserByIdOrName(id, name) {
  if (!id && !name) {
    return null;
  }
  try {
    const where = [];
    const replacements = [];
    if (id) {
      if (Number.isNaN(parseInt(id, 10))) {
        /* first argument is a name instead */
        name = id;
      } else {
        where.push('u.id = ?');
        replacements.push(id);
      }
    }
    if (name) {
      where.push('u.username = ?');
      where.push('u.name = ?');
      replacements.push(id, id);
    }
    const userdata = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT u.id, u.name, u.username, u.password, u.flags, u.userlvl FROM Users u WHERE ${
        where.join(' OR ')
      }`, {
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    if (!userdata.length) {
      return null;
    }
    if (userdata.length === 1) {
      return userdata[0];
    }
    /* priorities: uid > username > name */
    let tmpData;
    for (let i = 0; i < userdata.length; i += 1) {
      const data = userdata[i];
      if (data.id === id) {
        return data;
      } if (data.username === name) {
        tmpData = data;
      }
    }
    if (tmpData) {
      return tmpData;
    }
    return userdata[0];
  } catch (error) {
    console.error(`SQL Error on findUserByIdOrName: ${error.message}`);
  }
  return null;
}

/**
 * find name and mail of user by id
 * @param id user id
 * @return [name, email]
 */
export async function getMailAndNameOfUserId(id) {
  try {
    const result = await sequelize.query(
      `SELECT u.name, t.tpid FROM Users u
  INNER JOIN ThreePIDs t ON t.uid = u.id
WHERE u.id = ? AND t.provider = 1 AND t.verified = ? LIMIT 1`, {
        replacements: [id, true],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (result) {
      return [result.name, result.tpid];
    }
  } catch (error) {
    console.error(`SQL Error on getMailAndNameOfUserId: ${error.message}`);
  }
  return [null, null];
}

/**
 * get basic profile info for openid
 * @param id user id
 * @return { name, username, mail, verified}
 */
export async function getUserOIDCProfile(id) {
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT u.name, u.userlvl, u.username, u.createdAt, t.tpid AS email, t.verified FROM Users u
  LEFT JOIN ThreePIDs t ON t.uid = u.id AND t.provider = 1
WHERE u.id = ? ORDER BY t.verified DESC LIMIT 1`, {
        replacements: [id],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getUserOIDCProfile: ${error.message}`);
  }
  return null;
}

/**
 * set one bit in flags of user
 * @param id user id
 * @param index index of flag (see order in Model definition up there)
 * @param value 0 or 1, true or false
 * @return success boolean
 */
export async function setFlagOfUser(id, index, value) {
  try {
    const mask = 0x01 << index;
    if (value) {
      await sequelize.query(
        'UPDATE Users SET flags = flags | ? WHERE id = ?', {
          replacements: [mask, id],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      await sequelize.query(
        'UPDATE Users SET flags = flags & ~(?) WHERE id = ?', {
          replacements: [mask, id],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    }
    return true;
  } catch (error) {
    console.error(`SQL Error on setFlagOfUser: ${error.message}`);
  }
  return false;
}

/**
 * get User by tpid
 * @param provider
 * @param tpid
 * @return limited user object or null if not found
 */
export async function getUserByTpid(provider, tpid) {
  if (!tpid || !provider) {
    return null;
  }
  try {
    return await User.findOne({
      attributes: ['id', 'name', 'username', 'password', 'flags', 'userlvl'],
      include: {
        association: 'tpids',
        where: {
          provider,
          [Op.or]: [
            { tpid },
            {
              [Op.not]: { normalizedTpid: null },
              normalizedTpid: Sequelize.fn('NORMALIZE_TPID', provider, tpid),
            },
          ],
        },
        required: true,
      },
      raw: true,
      nested: true,
    });
  } catch (error) {
    console.error(`SQL Error on getUserByTpid: ${error.message}`);
    throw error;
  }
}

/**
 * get User by email
 * @param email
 * @return limited user object or null if not found
 */
export function getUserByEmail(email) {
  return getUserByTpid(THREEPID_PROVIDERS.EMAIL, email);
}

/**
 * check if name is taken and if it is,
 * modify it till we find a name that is available
 * @param name
 * @return unique name
 */
export async function getNameThatIsNotTaken(name) {
  let limit = 5;
  let user = await User.findOne({
    attributes: ['id'],
    where: { name },
    raw: true,
  });
  while (user) {
    limit -= 1;
    if (!limit) {
      return randomUUID().split('-').join('');
    }
    // eslint-disable-next-line max-len
    name = `${name.substring(0, 15)}-${Math.random().toString(36).substring(2, 10)}`;
    // eslint-disable-next-line no-await-in-loop
    user = await User.findOne({
      attributes: ['id'],
      where: { name },
      raw: true,
    });
  }
  return name;
}

/**
 * verify a users email
 * @param email
 * @return name if successful, otherwise false
 */
export async function verifyEmail(email) {
  if (!email) {
    return false;
  }
  try {
    const user = await User.findOne({
      include: {
        association: 'tpids',
        required: true,
        where: {
          provider: THREEPID_PROVIDERS.EMAIL,
          tpid: email,
        },
      },
    });
    if (!user) {
      return false;
    }
    const promises = [
      user.tpids[0].update({ verified: true }),
    ];
    if (user.userlvl === USERLVL.REGISTERED) {
      promises.push(user.update({ userlvl: USERLVL.VERIFIED }));
    }
    await Promise.all(promises);
    return user.id;
  } catch (err) {
    console.error(`SQL Error on verifyEmail: ${err.message}`);
    return false;
  }
}

/**
 * get Users by name or email
 * @param name (or either name or email if email not given)
 * @param email (optional)
 * @param username (optional)
 * @param populate boolean
 * @return [{ id, name, username, password, userlvl, byEmail }, ... ] | null
 *   on error
 */
export async function getUsersByNameOrEmail(name, email, username) {
  if (!name) {
    return [];
  }
  if (!email) {
    email = name;
  }
  if (!username) {
    username = name;
  }
  try {
    return await sequelize.query(
      /* eslint-disable max-len */
      `SELECT u.id, u.name, u.username, u.password, u.flags, u.userlvl,
EXISTS (SELECT 1 FROM ThreePIDs WHERE uid = u.id AND provider = 1 AND normalizedTpid = NORMALIZE_TPID(1, ?)) AS 'byEMail'
FROM Users u
WHERE u.name = ? OR u.username = CONVERT(? USING ascii) OR
EXISTS (SELECT 1 FROM ThreePIDs WHERE uid = u.id AND provider = 1 AND normalizedTpid = NORMALIZE_TPID(1, ?))`, {
        /* eslint-enable max-len */
        replacements: [email, name, username, email],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
  } catch (err) {
    console.error(`SQL Error on getUsersByNameOrEmail: ${err.message}`);
    return null;
  }
}

/**
 * create new User
 * @param name
 * @param [password]
 * @return limited user object or null if not successful
 */
export async function createNewUser(
  name, password, username, userlvl = USERLVL.REGISTERED,
) {
  if (!username) {
    username = '=';
  }
  const query = { name, userlvl, username };
  if (password) query.password = password;
  try {
    return await User.create(query);
  } catch (error) {
    console.error(`SQL Error on createNewUser: ${error.message}`);
    return null;
  }
}

/**
 * set userlvl
 * @param id user id
 * @param userlvl user level
 * @return boolean success
 */
export async function setUserLvl(id, userlvl) {
  try {
    await User.update({ userlvl }, { where: { id }, returning: false });
    return true;
  } catch (error) {
    console.error(`SQL Error on setUserLvl: ${error.message}`);
  }
  return false;
}

/**
 * set name
 * @param id user id
 * @param name name
 */
export async function setName(id, name) {
  try {
    await User.update({ name }, { where: { id }, returning: false });
  } catch (error) {
    return false;
  }
  return true;
}

/**
 * set name
 * @param id user id
 * @param name name
 */
export async function setUsername(id, username) {
  try {
    await User.update({ username }, { where: { id }, returning: false });
  } catch (error) {
    return false;
  }
  return true;
}

/**
 * set password
 * @param id user id
 * @param password password in cleartext (we hash it here)
 */
export async function setPassword(id, password) {
  try {
    await User.update({ password }, { where: { id }, returning: false });
  } catch (error) {
    console.error(`SQL Error on setPassword: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * delete user
 * @param id user id
 * @return {
 *   dmChannels: [{ cid, uidA, uidB }, ...] destroyed channels
 * }
 */
export async function deleteUser(id) {
  try {
    const dmChannels = await deleteAllDMChannelsOfUser(id);
    if (dmChannels === null) {
      throw new Error('Could not destroy DM channels');
    }
    await User.destroy({ where: { id } });
    return { dmChannels };
  } catch (error) {
    console.error(`SQL Error on deleteUser: ${error.message}`);
    return null;
  }
}

/**
 * get basic information of user
 * @param userlvl userlevel
 * @return { id, name }
 */
export async function getHighUserLvlUsers() {
  try {
    const userModels = await User.findAll({
      where: { userlvl: { [Op.gte]: USERLVL.CLEANER } },
      attributes: ['name', 'id', 'userlvl'],
      raw: true,
    });
    const usersByLvl = {};
    for (let i = 0; i < userModels.length; i += 1) {
      const { name, id, userlvl } = userModels[i];
      if (!usersByLvl[userlvl]) {
        usersByLvl[userlvl] = [];
      }
      usersByLvl[userlvl].push([id, name]);
    }
    return usersByLvl;
  } catch (error) {
    console.error(`SQL Error on getHighUserLvlUsers: ${error.message}`);
  }
  return {};
}

/**
 * take array of objects that include user ids and add
 * user informations if user if not private
 * @param rawRanks array of {id: userId, ...} objects
 */
export async function populateIdObj(rawRanks) {
  if (!rawRanks.length) {
    return rawRanks;
  }
  const uids = rawRanks.map((r) => r.id);
  const userData = await sequelize.query(
    // eslint-disable-next-line max-len
    `SELECT u.id, u.name, DATEDIFF(CURRENT_TIMESTAMP(), u.createdAt) AS 'age' FROM Users u
WHERE (u.flags & ?) = 0 AND u.id IN (?);`, {
      replacements: [0x01 << USER_FLAGS.PRIV, uids],
      raw: true,
      type: QueryTypes.SELECT,
    },
  );
  for (const { id, name, age } of userData) {
    const dat = rawRanks.find((r) => r.id === id);
    if (dat) {
      dat.name = name;
      dat.age = age;
    }
  }
  return rawRanks;
}

export default User;
