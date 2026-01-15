/**
 * Sequelize SQL
 */

/* eslint-disable max-len */

import Sequelize from 'sequelize';

import {
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, LOG_MYSQL,
} from '../../core/config.js';

console.log(MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD)
const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, {
  host: MYSQL_HOST,
  dialect: 'mysql',
  define: {
    timestamps: false,
  },
  pool: {
    min: 5,
    max: 25,
    idle: 10000,
    acquire: 10000,
  },
  // eslint-disable-next-line no-console
  logging: (LOG_MYSQL) ? (sql) => console.info(sql) : false,
  dialectOptions: {
    connectTimeout: 10000,
    multipleStatements: true,
    maxPreparedStatements: 100,
  },
});

/**
 * nest raw queries
 * Sequelize raw: true queries return association as table.column names,
 * and if we make sure that we only do this form on M:N associations, we can
 * nest the results
 * @param query query return object, which is an array
 * @param primaryKey any key that is unique to nest for, if null, nest all and
 *   return only onw object
 * @return nested query
 */
export function nestQuery(query, primaryKey) {
  if (!query?.length) {
    if (primaryKey) {
      return [];
    }
    return null;
  }
  const ret = [];

  const mainColumns = [];
  const nestedColumns = [];
  const columns = Object.keys(query[0]);
  let i = columns.length;
  while (i > 0) {
    i -= 1;
    const k = columns[i];
    const seperator = k.indexOf('.');
    if (seperator === -1) {
      mainColumns.push(k);
    } else {
      nestedColumns.push(
        [k.substring(0, seperator), k.substring(seperator + 1)],
      );
    }
  }

  i = query.length;
  while (i > 0) {
    i -= 1;
    const row = query[i];

    let target;
    if (primaryKey) {
      const primary = row[primaryKey];
      target = ret.find(
        (r) => r[primaryKey].toString() === primary.toString(),
      );
    } else {
      // eslint-disable-next-line prefer-destructuring
      target = ret[0];
    }

    if (!target) {
      target = {};
      mainColumns.forEach((k) => {
        target[k] = row[k];
      });
      nestedColumns.forEach(([k]) => {
        target[k] = [];
      });
      ret.push(target);
    }

    const nestedObj = {};
    const notNullObj = {};
    let u = nestedColumns.length;
    while (u > 0) {
      u -= 1;
      const [k, v] = nestedColumns[u];
      if (!nestedObj[k]) {
        nestedObj[k] = {};
      }
      const value = row[`${k}.${v}`];
      const obj = nestedObj[k];
      obj[v] = value;
      if (value !== null) {
        notNullObj[k] = obj;
      }
    }

    const notNullKeys = Object.keys(notNullObj);
    u = notNullKeys.length;
    while (u > 0) {
      u -= 1;
      const k = notNullKeys[u];
      target[k].push(nestedObj[k]);
    }
  }

  return (primaryKey) ? ret : ret[0];
}

/**
 * replacer for JSON.stringify
 * this is set by JSON.stringify to the current object we are in
 * @param key
 * @param value
 * @return parsed value
 */
function jsonReplacer(key, value) {
  if (key) {
    /* get this[k], because value is already stringified */
    const originalValue = this[key];
    let modifier;
    if (originalValue instanceof Date) {
      modifier = 'ts';
      value = originalValue.getTime();
    }
    /* if we need more than only Date, add here */
    if (modifier) {
      value = `ts(${value})`;
    }
  }
  return value;
}

/**
 * reviver for JSON.parse
 * @param key
 * @param value
 * @param context { source: original string before parsing }
 * @return parsed value
 */
function jsonReviver(key, value, context) {
  if (context && typeof value === 'string' && value.endsWith(')')) {
    const openingBreaket = value.indexOf('(');
    if (openingBreaket !== -1) {
      const parsedValue = value.substring(openingBreaket + 1, value.length - 1);
      const modifier = value.substring(0, openingBreaket);
      switch (modifier) {
        case 'ts':
          return new Date(Number(parsedValue));
        /* if we need more than only Date, add here */
        default:
          // nothing
      }
    }
  }
  return value;
}

/**
 * convert a raw sequelize object into a json string
 * @param rawObject the object resulting of a { raw: true, nested: true } call
 * @return json string
 */
export function sequelizeRawToJson(rawObject) {
  return JSON.stringify(rawObject, jsonReplacer);
}

/**
 * convert a json string to a sequlize raw object
 * @param json
 * @return raw sequelize object
 */
export function jsonToSequelizeRaw(json) {
  return JSON.parse(json, jsonReviver);
}

/*
 * estabish database connection
 */
export const sync = async (alter = false) => {
  await sequelize.sync({ alter: { drop: alter } });

  /*
   * custom functions (for IP_BIN explenation, look into IP_Info comments)
   */
  const functions = {
    IP_TO_BIN: `CREATE FUNCTION IF NOT EXISTS IP_TO_BIN(ip VARCHAR(39)) RETURNS VARBINARY(8) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE longBin VARBINARY(16);
  SET longBin = INET6_ATON(ip);
  IF LENGTH(longBin) > 4
    THEN
      RETURN SUBSTRING(longBin, 1, 8);
    ELSE
      RETURN (longBin);
  END IF;
END`,
    BIN_TO_IP: `CREATE FUNCTION IF NOT EXISTS BIN_TO_IP(bin VARBINARY(8)) RETURNS VARCHAR(21) DETERMINISTIC CONTAINS SQL
BEGIN
  RETURN (INET6_NTOA(IF(LENGTH(bin) > 4, CAST(bin as BINARY(16)), bin)));
END`,
    NORMALIZE_TPID: `CREATE FUNCTION IF NOT EXISTS NORMALIZE_TPID(provider TINYINT(4) UNSIGNED, tip VARCHAR(80)) RETURNS VARCHAR(80) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE atPos TINYINT UNSIGNED;
  IF provider != 1 THEN
    RETURN NULL;
  END IF;
  SET atPos = LOCATE('@', tip);
  IF atPos = 0 THEN
    RETURN NULL;
  END IF;
  RETURN (LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(tip, '@', 1), '+', 1), '.', ''),'@',(SUBSTRING_INDEX(tip, '@', -1)))));
END`,
    NAME_TO_USERNAME: `CREATE FUNCTION IF NOT EXISTS NAME_TO_USERNAME(name VARCHAR(32)) RETURNS VARCHAR(32) DETERMINISTIC
BEGIN
  RETURN CONCAT('pp_', REGEXP_REPLACE(name, '[^a-zA-Z0-9._-]', ''));
END`,
    UUID_TO_BIN: `CREATE FUNCTION IF NOT EXISTS UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC
BEGIN
  RETURN UNHEX(REPLACE(uuid, '-', ''));
END`,
    BIN_TO_UUID: `CREATE FUNCTION IF NOT EXISTS BIN_TO_UUID(bin_uuid BINARY(16)) RETURNS CHAR(36) DETERMINISTIC
BEGIN
    DECLARE hex_uuid CHAR(32);
    SET hex_uuid = HEX(bin_uuid);
    RETURN LOWER(CONCAT(
        SUBSTR(hex_uuid, 1, 8), '-',
        SUBSTR(hex_uuid, 9, 4), '-',
        SUBSTR(hex_uuid, 13, 4), '-',
        SUBSTR(hex_uuid, 17, 4), '-',
        SUBSTR(hex_uuid, 21, 12)
    ));
END`,
    RANGE_OF_IP: `CREATE PROCEDURE IF NOT EXISTS RANGE_OF_IP(ip VARCHAR(39)) READS SQL DATA
BEGIN
  DECLARE binIp VARBINARY(8);
  SET binIp = IP_TO_BIN(ip);
  SELECT id as wid, CONCAT(BIN_TO_IP(min), '/', mask) AS cidr, country, org, descr, asn FROM Ranges WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min) AND expires > NOW() LIMIT 1;
  IF FOUND_ROWS() = 0
    THEN
      SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIp) = LENGTH(min) AND expires > NOW() LIMIT 1;
  END IF;
END`,
    RANGE_OF_IP_OI: `CREATE PROCEDURE IF NOT EXISTS RANGE_OF_IP_OI(ip VARCHAR(39)) MODIFIES SQL DATA
BEGIN
  DECLARE binIp VARBINARY(8);
  DECLARE q_id INTEGER UNSIGNED;
  DECLARE q_cidr VARCHAR(22);
  DECLARE q_country CHAR(2);
  DECLARE q_org, q_descr VARCHAR(60) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
  DECLARE q_asn VARCHAR(12);
  DECLARE whois_host VARCHAR(60);
  SET binIp = IP_TO_BIN(ip);
  SELECT id, CONCAT(BIN_TO_IP(min), '/', mask), country, org, descr, asn FROM Ranges WHERE min <= binIp AND max >= binIp AND LENGTH(binIp) = LENGTH(min) AND expires > NOW() LIMIT 1 INTO q_id, q_cidr, q_country, q_org, q_descr, q_asn;
  IF q_id IS NULL
    THEN
      SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIp) = LENGTH(min) AND expires > NOW() LIMIT 1 INTO whois_host;
    ELSE
      INSERT INTO IPs (ip, uuid, rid) VALUES (binIP, UUID_TO_BIN(UUID()), q_id) ON DUPLICATE KEY UPDATE rid = q_id;
  END IF;
  SELECT q_cidr AS cidr, q_country AS country, q_org AS org, q_descr AS descr, q_asn AS asn, whois_host;
END`,
    GET_USER_ALLOWANCE: `CREATE PROCEDURE IF NOT EXISTS GET_USER_ALLOWANCE(uid INTEGER UNSIGNED) READS SQL DATA
BEGIN
  SELECT
    (SELECT bid FROM UserBans ub WHERE ub.uid = uid LIMIT 1) AS userBanId,
    (SELECT tb.bid FROM Users u INNER JOIN ThreePIDs t ON t.uid = u.id INNER JOIN ThreePIDBans tb ON tb.tid = t.id WHERE u.id = uid LIMIT 1) AS tpidBanId;
END`,
    WHOIS_REFERRAL_OF_IP: `CREATE PROCEDURE IF NOT EXISTS WHOIS_REFERRAL_OF_IP(ip VARCHAR(39)) READS SQL DATA
BEGIN
  DECLARE binIp VARBINARY(8);
  SET binIp = IP_TO_BIN(ip);
  SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min);
END`,
  };

  const isMariaDB = (await sequelize.query('SELECT VERSION() AS version'))[0][0].version.includes('MariaDB');
  if (!isMariaDB) {
    /* those functions are native to MySQL 8+ */
    delete functions.UUID_TO_BIN;
    delete functions.BIN_TO_UUID;
  }

  const promises = [];
  for (const name of Object.keys(functions)) {
    if (alter) {
      if (functions[name].includes('PROCEDURE')) {
        promises.push(sequelize.query(`DROP PROCEDURE IF EXISTS ${name}`,
          { raw: true },
        ));
      } else if (functions[name].includes('FUNCTION')) {
        promises.push(sequelize.query(`DROP FUNCTION IF EXISTS ${name}`,
          { raw: true },
        ));
      }
    }
    promises.push(sequelize.query(functions[name]));
  }
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(`Error on creating SQL Function: ${err.message}`);
  }
};

export default sequelize;
