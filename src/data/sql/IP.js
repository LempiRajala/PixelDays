import { DataTypes, QueryTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { USE_PROXYCHECK } from '../../core/config.js';
import { generateUUID } from '../../utils/hash.js';
import { sanitizeIPString } from '../../utils/intel/ip.js';

const IP = sequelize.define('IP', {
  /*
   * Store both 32bit IPv4 and first half of 128bit IPv6
   * (only the first 64bit of a v6 is usually assigned
   * to customers by ISPs, the second half is assigned by devices)
   * NOTE:
   * IPv6 addresses in the ::/32 subnet would map to IPv4, which
   * should be no issues, because ::/8 is reserved by IETF
   */
  ip: {
    type: 'VARBINARY(8)',
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Get basic values to check if an ip is allows, may throw Error
 * @param {string} ipString
 * @return {{
 *   lastSeen,
 *   isWhitelisted,
 *   isProxy,
 *   bans: [ { expires, flags } ],
 *   country: string,
 *   whoisExpiresTs: number,
 *   proxyCheckExpiresTs: number,
 * }}
 * @description country - two letter country code, whoisExpiresTs - timestamp for when whois expires, proxyCheckExpiresTs - timestamp for when proxycheck expires
 */
export async function getIPAllowance(ipString) {
  let ipAllowance;
  try {
    ipAllowance = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT COALESCE(i.lastSeen, NOW() - INTERVAL 5 MINUTE) as lastSeen,
COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted,
COALESCE(r.country, 'xx') AS country,
COALESCE(r.expires, NOW() - INTERVAL 5 MINUTE) AS whoisExpires,
COALESCE(p.expires, NOW() - INTERVAL 5 MINUTE) AS proxyCheckExpires,
b.expires AS 'bans.expires', b.flags AS 'bans.flags' FROM IPs i
  LEFT JOIN ProxyWhitelists w ON w.ip = i.ip
  LEFT JOIN Proxies p ON p.ip = i.ip AND p.expires > NOW()
  LEFT JOIN Ranges r ON r.id = i.rid AND r.expires > NOW()
  LEFT JOIN IPBans ib ON ib.ip = i.ip
  LEFT JOIN Bans b ON b.id = ib.bid AND (b.expires > NOW() OR b.expires IS NULL)
WHERE i.ip = IP_TO_BIN(?)`, {
      /* eslint-enable max-len */
        replacements: [ipString],
        raw: true,
        type: QueryTypes.SELECT,
      });
    ipAllowance = nestQuery(ipAllowance);

    if (ipAllowance) {
      ipAllowance.isProxy = ipAllowance.isProxy === 1;
      ipAllowance.isWhitelisted = ipAllowance.isWhitelisted === 1;
      ipAllowance.whoisExpiresTs = ipAllowance.whoisExpires.getTime();
      // eslint-disable-next-line max-len
      ipAllowance.proxyCheckExpiresTs = ipAllowance.proxyCheckExpires.getTime();
      delete ipAllowance.whoisExpires;
      delete ipAllowance.proxyCheckExpires;
    }
  } catch (error) {
    console.error(`SQL Error on getIPAllowance: ${error.message}`);
  }

  if (!ipAllowance) {
    const expiredTs = Date.now() - 10 * 3600 * 1000;

    ipAllowance = {
      isWhitelisted: false,
      bans: [],
      country: 'xx',
      isProxy: false,
      lastSeen: new Date(),
      whoisExpiresTs: expiredTs,
      proxyCheckExpiresTs: expiredTs,
    };
  }

  if (!USE_PROXYCHECK) {
    ipAllowance.proxyCheckExpiresTs = Infinity;
  }

  return ipAllowance;
}

/**
 * Save ip information. If woisData or pcData aren't available, don't save
 * the specific one. Data objects need to have an expiration date.
 * If whoisData has an rid, don't write new whois data, but use that rid
 * @param ipString ip as string
 * @param whoisData null | {
 *   [rid]: id of range,
 *   expiresTs: timestamp when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 * @param pcData null | {
 *   expiresTs: timestamp when data expires,
 *   isProxy: true or false,
 *   type: Residential, Wireless, VPN, SOCKS,...,
 *   operator: name of proxy operator if available,
 *   city: name of city,
 *   devices: amount of devices using this ip,
 *   subnetDevices: amount of devices in this subnet,
 * }
 * @return success boolean
 */
export async function saveIPIntel(ipString, whoisData, pcData) {
  try {
    const transaction = await sequelize.transaction();

    try {
      const promises = [];
      let rid = null;

      if (whoisData) {
        if (whoisData.rid) {
          rid = whoisData.rid;
        } else {
          const {
            range, country = 'xx', asn = null,
            referralHost, referralRange,
            expiresTs: whoisExpiresTs,
          } = whoisData;
          let { org = null, descr = null } = whoisData;

          if (org) {
            org = org.slice(0, 60);
          }
          if (descr) {
            descr = descr.slice(0, 60);
          }

          if (referralRange && referralHost) {
            promises.push(sequelize.query(
              /* eslint-disable max-len */
              `INSERT INTO WhoisReferrals (min, max, mask, host, expires) VALUES (UNHEX(?), UNHEX(?), ?, ?, ?)
ON DUPLICATE KEY UPDATE min = VALUES(min), max = VALUES(max), mask = VALUES(mask), host = VALUES(host), expires = VALUES(expires)`, {
                replacements: [
                  referralRange[0], referralRange[1], referralRange[2], referralHost, new Date(whoisExpiresTs),
                ],
                raw: true,
                type: QueryTypes.INSERT,
                transaction,
              },
            ));
          }

          /*
           * if we would be always on MariaDB, we could use append RETURNING id and
           * get the id during the insert
           */
          promises.push(sequelize.query(
            `INSERT INTO Ranges (min, max, mask, country, org, descr, asn, expires) VALUES (UNHEX(?), UNHEX(?), ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE min = VALUES(min), max = VALUES(max), mask = VALUES(mask), country = VALUES(country), org = VALUES(org), descr = VALUES(descr), asn = VALUES(asn), expires = VALUES(expires)`, {
              replacements: [
                range[0], range[1], range[2], country, org, descr, asn, new Date(whoisExpiresTs),
              ],
              raw: true,
              type: QueryTypes.INSERT,
              transaction,
            }));

          try {
            await Promise.all(promises);
          } catch (error) {
            /*
             * ignore unique violations, that can happen when a row with min and
             * a different row with max matches
             */
            if (!error.errors
              || error.errors.some(({ type }) => type !== 'unique violation')
            ) {
              throw error;
            }
          }

          const whoisResult = await sequelize.query(
            'SELECT id FROM Ranges WHERE min = UNHEX(?) AND max = UNHEX(?)', {
              replacements: [range[0], range[1]],
              raw: true,
              type: QueryTypes.SELECT,
              transaction,
            });

          if (whoisResult[0]) {
            rid = whoisResult[0].id;
          }
        }
      }

      await sequelize.query(
        'INSERT INTO IPs (ip, uuid, rid, lastSeen) VALUES (IP_TO_BIN(?), ?, ?, NOW()) ON DUPLICATE KEY UPDATE rid = VALUES(rid)', {
          replacements: [ipString, generateUUID(), rid],
          raw: true,
          type: QueryTypes.INSERT,
          transaction,
        },
      );

      if (pcData) {
        const {
          isProxy, type = null, operator = null, city = null,
          devices = 1, subnetDevices = 1,
        } = pcData;
        await sequelize.query(
          `INSERT INTO Proxies (ip, isProxy, type, operator, city, devices, subnetDevices, expires) VALUES (IP_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE isProxy = VALUES(isProxy), type = VALUES(type), operator = VALUES(operator), city = VALUES(city), devices = VALUES(devices), subnetDevices = VALUES(subnetDevices), ip = VALUES(ip), expires = VALUES(expires)`, {
            replacements: [
              ipString,
              isProxy, type, operator, city, devices, subnetDevices,
              new Date(pcData.expiresTs),
            ],
            raw: true,
            type: QueryTypes.INSERT,
            transaction,
          },
        );
      }
      /* eslint-enable max-len */

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    // eslint-disable-next-line max-len
    console.error(`SQL Error on saveIPIntel for ${ipString}, ${JSON.stringify(whoisData)}, ${JSON.stringify(pcData)}: ${error.message}`);
    error.errors?.forEach((s) => console.error(s.message));
  }
  return false;
}

/**
 * get basic informations of ip
 * @param ipStrings Array of multiple or single ipStrings
 * @param ipUuids Array of multiple or single ip uuids (IID)
 * @return [{
 *   iid,
 *   ipString,
 *   country,
 *   cidr,
 *   org,
 *   descr,
 *   asn,
 *   type,
 *   isProxy,
 *   isWhitelisted,
 * }, ...]
 */
export async function getIPInfos(ipStrings, ipUuids) {
  const ipInfos = new Map();
  try {
    const where = [];
    let replacements = [];
    let requestAmount = 0;

    if (ipStrings) {
      if (Array.isArray(ipStrings)) {
        if (ipStrings.length) {
          /* eslint-disable max-len */
          where.push(`ip.ip IN (SELECT m.ip FROM (${
            ipStrings.map(() => 'SELECT IP_TO_BIN(?) AS \'ip\'').join(' UNION ALL ')
          }) AS m)`);
          replacements = replacements.concat(ipStrings);
          requestAmount += ipStrings.length;
        }
      } else {
        where.push('ip.ip = IP_TO_BIN(?)');
        replacements.push(ipStrings);
        requestAmount += 1;
      }
    }

    if (ipUuids) {
      if (Array.isArray(ipUuids)) {
        if (ipUuids.length) {
          where.push(`ip.uuid IN (SELECT l.ip FROM (${
            ipUuids.map(() => 'SELECT UUID_TO_BIN(?) AS \'ip\'').join(' UNION ALL ')
          }) AS l)`);
          replacements = replacements.concat(ipUuids);
          requestAmount += ipUuids.length;
        }
      } else {
        where.push('ip.uuid = UUID_TO_BIN(?)');
        replacements.push(ipUuids);
        requestAmount += 1;
      }
    }

    if (requestAmount === 0 || requestAmount > 300) {
      return ipInfos;
    }

    const startTime = Date.now();
    const ipInfoModels = await sequelize.query(
      `SELECT BIN_TO_UUID(ip.uuid) AS 'iid', BIN_TO_IP(ip.ip) AS 'ipString',
COALESCE(r.country, 'xx') AS 'country', r.org, r.descr, r.asn, CONCAT(BIN_TO_IP(r.min), '/', r.mask) AS 'cidr',
p.type, COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted
FROM IPs ip
  LEFT JOIN Ranges r ON r.id = ip.rid
  LEFT JOIN Proxies p ON p.ip = ip.ip
  LEFT JOIN ProxyWhitelists w ON w.ip = ip.ip
WHERE ${(where.length === 1) ? where[0] : `(${where.join(' OR ')})`}`, {
        /* eslint-enable max-len */
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    /* sanitize ips */
    for (let i = 0; i < ipInfoModels.length; i += 1) {
      const ipInfo = ipInfoModels[i];
      const ipString = sanitizeIPString(ipInfo.ipString);
      delete ipInfo.ipString;
      ipInfos.set(ipString, ipInfo);
    }
    console.log(
      `SQL Resolving IPInfos took ${(Date.now() - startTime) / 1000}s`,
    );

    return ipInfos;
  } catch (error) {
    console.error(`SQL Error on getInfoToIp: ${error.message}`);
  }
  return ipInfos;
}

/**
 * get provider info to ip, if we have it stored
 * @param ipString
 * @return { asn, org } | null
 */
export async function getProviderOfIP(ipString) {
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT r.asn, r.org FROM IPs ip INNER JOIN Ranges r ON r.id = ip.rid WHERE ip.ip = IP_TO_BIN(?)', {
        replacements: [ipString],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    return result;
  } catch (error) {
    console.error(`SQL Error on getASN: ${error.message}`);
  }
  return null;
}

/**
 * update lastSeen timestamps of IP
 * @param ipString ip as string
 * @return sucess boolean
 */
export async function touchIP(ipString) {
  try {
    await sequelize.query(
      'UPDATE IPs SET lastSeen = NOW() WHERE ip = IP_TO_BIN($1)', {
        bind: [ipString],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on touchIP: ${error.message}`);
  }
  return false;
}

/**
 * get IP of IID (which is just the uuid in this table)
 * @param uuid IID as String
 * @return null | uuid as String
 */
export async function getIPofIID(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT BIN_TO_IP(i.ip) AS \'ip\' FROM IPs i WHERE i.uuid = UUID_TO_BIN(?)', {
        replacements: [uuid],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    return result?.ip;
  } catch (error) {
    console.error(`SQL Error on getIPofIID: ${error.message}`);
  }
  return null;
}

/**
 * find other users and ips connected to one
 * @param uid userId
 * @param ipString ipString
 * @return [ ipStrings, userIds ]
 */
export async function findAlts(userId, ipString) {
  const userIds = new Set();
  const iids = new Set();
  try {
    if (userId) {
      const userIps = await sequelize.query(
        // eslint-disable-next-line max-len
        'SELECT BIN_TO_UUID(i.uuid) AS iid, l.uid FROM UserIPs l INNER JOIN IPs i ON l.ip = i.ip INNER JOIN UserIPs m ON m.ip = l.ip WHERE m.uid = ?', {
          replacements: [userId],
          raw: true,
          type: QueryTypes.SELECT,
        },
      );
      userIps.forEach(({ iid, uid }) => {
        iids.add(iid);
        userIds.add(uid);
      });
    }
    if (ipString) {
      const userIps = await sequelize.query(
        // eslint-disable-next-line max-len
        'SELECT BIN_TO_UUID(i.uuid) AS iid, l.uid FROM UserIPs l INNER JOIN IPs i ON l.ip = i.ip INNER JOIN UserIPs m ON m.uid = l.uid WHERE m.ip = IP_TO_BIN(?)', {
          replacements: [ipString],
          raw: true,
          type: QueryTypes.SELECT,
        },
      );
      userIps.forEach(({ iid, uid }) => {
        iids.add(iid);
        userIds.add(uid);
      });
    }
  } catch (error) {
    console.error(`SQL Error on findAlts: ${error.message}`);
  }
  return [[...iids], [...userIds]];
}

/**
 * get IID of IP (which is just the uuid in this table)
 * @param ipString ip as String
 * @return null | uuid as String
 */
export async function getIIDofIP(ipString) {
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT BIN_TO_UUID(i.uuid) AS \'iid\' FROM IPs i WHERE i.ip = IP_TO_BIN(?)', {
        replacements: [ipString],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    return result[0]?.iid;
  } catch (error) {
    console.error(`SQL Error on getIIDofIP: ${error.message}`);
  }
  return null;
}

/**
 * get IPs of IIDs (which is just the uuid in this table)
 * @param uuid Array of IID strings
 * @return Map<{ uuid: ipString }>
 */
export async function getIPsOfIIDs(uuids) {
  const idToIPMap = new Map();

  let where = '';
  let replacements;
  if (uuids) {
    if (Array.isArray(uuids)) {
      if (uuids.length && uuids.length <= 300) {
        const placeholder = uuids
          .map(() => 'SELECT UUID_TO_BIN(?) AS \'uuid\'').join(' UNION ALL ');
        where += `i.uuid IN (SELECT l.uuid FROM (${placeholder}) AS l)`;
        replacements = uuids;
      }
    } else {
      where += 'i.uuid = UUID_TO_BIN(?)';
      replacements = [uuids];
    }
  }

  if (!replacements) {
    return idToIPMap;
  }

  try {
    const result = await sequelize.query(
      `SELECT BIN_TO_IP(i.ip) AS 'ip', BIN_TO_UUID(i.uuid) AS 'iid' FROM IPs i
WHERE ${where}`, {
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    result.forEach((obj) => {
      idToIPMap.set(obj.iid, obj.ip);
    });
  } catch (error) {
    console.error(`SQL Error on getIPsOfIIDs: ${error.message}`);
  }
  return idToIPMap;
}

/**
 * get IIDs of IPs (which is just the uuid in this table)
 * @param ipStrings Array of or a single ip string
 * @return Map<{ ipString: uuid, ... }>
 */
export async function getIIDsOfIPs(ipStrings) {
  const ipToIdMap = new Map();

  let where = '';
  let replacements;
  if (ipStrings) {
    if (Array.isArray(ipStrings)) {
      if (ipStrings.length && ipStrings.length <= 300) {
        const placeholder = ipStrings
          .map(() => 'SELECT IP_TO_BIN(?) AS \'ip\'').join(' UNION ALL ');
        where += `i.ip IN (SELECT l.ip FROM (${placeholder}) AS l)`;
        replacements = ipStrings;
      }
    } else {
      where += 'i.ip = IP_TO_BIN(?)';
      replacements = [ipStrings];
    }
  }

  if (!replacements) {
    return ipToIdMap;
  }

  try {
    const result = await sequelize.query(
      `SELECT BIN_TO_IP(i.ip) AS 'ip', BIN_TO_UUID(i.uuid) AS 'iid' FROM IPs i
      WHERE ${where}`, {
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    result.forEach((obj) => {
      ipToIdMap.set(sanitizeIPString(obj.ip), obj.iid);
    });
  } catch (error) {
    console.error(`SQL Error on getIIDsOfIPs: ${error.message}`);
  }
  return ipToIdMap;
}

export default IP;
