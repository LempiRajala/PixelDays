import { QueryTypes } from 'sequelize';
import { sequelize, sync as syncSql, cleanDB } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { getIPAllowance, getIPsOfIIDs, getIIDsOfIPs, getIPofIID, getIIDofIP, touchIP } from '../src/data/sql/IP.js';
import { getBanInfos } from '../src/data/sql/Ban.js';
import { resolveSession, createSession } from '../src/data/sql/Session.js';
import { getUsersByNameOrEmail, setPassword, setUserLvl, createNewUser } from '../src/data/sql/User.js';
import { setEmail, getTPIDsOfUser } from '../src/data/sql/ThreePID.js';
import { createDMChannel, deleteDMChannel, deleteChannel } from '../src/data/sql/Channel.js';
import { notifyUserIpChanges, ban } from '../src/core/ban.js';
import { sanitizeIPString, ipToHex, hexToIP } from '../src/utils/intel/ip.js';
import { blockUser, unblockUser, isUserBlockedBy } from '../src/data/sql/association_models/UserBlock.js';
import { IP } from '../src/middleware/ip.js';
import { User } from '../src/middleware/session.js';
import { USERLVL } from '../src/core/constants.ts';

const LOG_QUERY = false;
const SYNC_MYSQL = false;

function title(title, spacer = '=') {
  const spacerAmount = Math.floor((80 - title.length - 2) / 2);
  let out = spacer.repeat(spacerAmount) + ' ' + title + ' ' + spacer.repeat(spacerAmount);
  if ((80 - title.length - 2) % 2) out += spacer;
  console.log(out);
}

function fail(message, value) {
  console.log(value);
  throw new Error(message);
}

async function initialize() {
  await syncSql(SYNC_MYSQL);
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
}

async function establishUsers() {
  const createUserIfNotExists = async (name, email, password) => {
    let userdata = await getUsersByNameOrEmail(name, email);
    if (userdata.length) {
      [userdata] = userdata;
      if (!userdata.byEMail && email) {
        await setEmail(userdata.id, email);
      }
    } else {
      userdata = await createNewUser(name, password);
      if (email) {
        await setEmail(userdata.id, email);
      }
    }
    return userdata;
  };

  title('establish Users');
  console.log('Create Users');
  const userdataA = await createUserIfNotExists('testA','testA@example.com');
  const userdataB = await createUserIfNotExists('testB','testB@example.com');
  const newusers = [
    [ 'test1', 'testtest', 'test1@example.com' ],
    [ 'test2', 'testtest', 'test2@example.com' ],
    [ 'test3', 'testtest', 'test3@example.com' ],
    [ 'test4', 'testtest', 'test4@example.com' ],
  ];
  for (const [name, password, email] of newusers) {
    let userdata = await createUserIfNotExists(name, email, password);
    if (name === 'test1') {
      await setUserLvl(userdata.id, 100);
    }
  };
  console.log('Create Sessions');
  const [tokena] = await createSession(userdataA.id, 5);
  const [tokenb] = await createSession(userdataB.id, 5);

  console.log('Check email existence');
  let tpids = await getTPIDsOfUser(userdataA.id);
  let emailTpid = tpids.find((t) => t.provider === 1 && t.tpid === 'testA@example.com');
  if (!emailTpid || emailTpid.length > 1) {
    fail('Error: Email didn\'t get set!', emailTpid);
  }
  tpids = await getTPIDsOfUser(userdataB.id);
  emailTpid = tpids.find((t) => t.provider === 1 && t.tpid === 'testB@example.com');
  if (!emailTpid || emailTpid.length > 1) {
    fail('Error: Email didn\'t get set!', emailTpid);
  }

  console.log('Oauth');


  return {
    uida: userdataA.id,
    uidb: userdataB.id,
    tokena, tokenb,
  }
}

async function ipMapping() {
  title('IP to IID Mapping');
  console.log('Establish IPs');
  const ipv6 = sanitizeIPString('2604::96e0:e121:2b82:29b7:3fa9');
  const ipv6Local = sanitizeIPString('::1');
  const ipv4 = sanitizeIPString('127.0.0.5');
  console.log(ipv6, ipToHex(ipv6), hexToIP(ipToHex(ipv6)));
  console.log(ipv6Local, ipToHex(ipv6Local), hexToIP(ipToHex(ipv6Local)));
  console.log(ipv4, ipToHex(ipv4), hexToIP(ipToHex(ipv4)));
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN(?), UUID_TO_BIN('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0'), NOW())`, {
      replacements: [ipv4],
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN('127.0.0.1'), UUID_TO_BIN('90ccd90a-c3e2-53d0-e889-c59c39cf9b45'), NOW())`, {
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN(?), UUID_TO_BIN('80ccd90a-c3e2-53d0-e889-c59c39cf9b45'), NOW())`, {
      replacements: [ipv6],
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  console.log('Get IPs OF IIDs');
  let out = await getIPsOfIIDs(['5c1f6618-4f8e-11f0-8cca-b61fc4d778f0', '80ccd90a-c3e2-53d0-e889-c59c39cf9b45']);
  if (out.get('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0') !== ipv4 || out.get('80ccd90a-c3e2-53d0-e889-c59c39cf9b45') !== ipv6) {
    fail('multiple getIPsOfIIDs', out);
  }
  out = await getIPsOfIIDs('90ccd90a-c3e2-53d0-e889-c59c39cf9b45');
  if (out.get('90ccd90a-c3e2-53d0-e889-c59c39cf9b45') !== '127.0.0.1') {
    fail('singular getIPsOfIIDs', out);
  }
  console.log('Get IIDs OF IPs');
  out = await getIIDsOfIPs(['127.0.0.1', ipv4]);
  if (out.get(ipv4) !== '5c1f6618-4f8e-11f0-8cca-b61fc4d778f0' || out.get('127.0.0.1') !== '90ccd90a-c3e2-53d0-e889-c59c39cf9b45') {
    fail('singular getIIDsOfIPs', out);
  }
  out = await getIIDsOfIPs(ipv4);
  if (out.get(ipv4) !== '5c1f6618-4f8e-11f0-8cca-b61fc4d778f0') {
    fail('singular getIIDsOfIPs', out);
  }
  console.log('Get individual IP');
  out = await getIPofIID('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0');
  if (out !== ipv4) {
    fail('getIPofIID', out);
  }
  console.log('Get individual IID');
  out = await getIIDofIP('127.0.0.1');
  if (out !== '90ccd90a-c3e2-53d0-e889-c59c39cf9b45') {
    fail('getIIDofIP', out);
  }
  console.log('Touch IP');
  out = await touchIP('127.0.0.1');
  if (!out) {
    fail('Could not touch ip');
  }
}

async function chat(users) {
  title('Chat');
  const { uida, uidb, tokena, tokenb } = users;
  console.log('Create DM channel');
  await deleteDMChannel(uida, uidb);
  const [cid, success] = await createDMChannel(uida, uidb);
  if (!success || !cid) {
    fail('createDMChannel', [cid, success]);
  }
  console.log('Resolve session with DM channel');
  let out = await resolveSession(tokena);
  const info = out.channels[cid];
  if (info[0] !== 'testB' || info[3] !== uidb) {
    fail('Resolve session with DM', out);
  }
  console.log('Block user');
  out = await isUserBlockedBy(uida, uidb);
  if (out) {
    await unblockUser(uida, uidb);
  }
  out = await blockUser(uida,uidb);
  if (!await isUserBlockedBy(uida, uidb)) {
    fail('Could not block user');
  }
  out = await resolveSession(tokena);
  if (!out.blocked.find(({id}) => id === uidb)) {
    fail('User block not in session', out);
  }
}

async function testWhois() {
  title('test WHOIS');
  /*
   * those are notiriously complicated IPs, because their providers have their
   * whois over some rwhois box in the middle of a jungle
   */
  const badIPs = [
    '69.178.112.123',
    '50.7.93.84',
    '2605:a601:a904:cc00:5918:f4cd:1dd1:a9c',
    '198.16.70.52',
    '198.16.78.45',
    '149.34.217.96',
    '38.9.254.98',
    '38.54.79.203',
    '38.91.101.217',
    '38.10.69.98',
    '50.7.93.28',
    '38.128.66.211',
    '198.16.66.125',
    '198.16.74.44',
    '198.16.70.28',
    '198.16.66.197',
    '38.54.57.78',
    '198.16.66.195',
    '198.16.66.101',
    '2604:3d09:217e:96e0:e121:2b82:29b7:3fa9',
    '149.57.29.157',
    '38.91.100.42',
    '149.71.172.36',
    '149.36.50.199',
    '50.5.243.186',
    '65.78.19.109',
    '160.2.105.243',
    '50.7.142.179',
    '198.16.66.140',
    '149.100.25.120',
    '50.7.93.28',
    '38.34.185.140',
    '198.16.78.44',
    '198.16.66.155',
    '38.107.255.226',
    '184.155.140.22',
    '2600:1001:b00c:7158:0000:0000:0000:0000',
    '181.165.235.69',
  ];
  for (let i = 0; i < badIPs.length; i += 1) {
    const ip = new IP({ connection: { remoteAddress: badIPs[i] } });
    console.log(await ip.getAllowance(true));
  }
}

(async () => {
  await initialize();

  let lsql;
  sequelize.options.logging = (sql, timing) => {
    if (LOG_QUERY) {
      console.log(sql);
    }
    lsql = sql;
  };

  try {
    const users = await establishUsers();
    await ipMapping();
    await chat(users);
    await testWhois();
    title('Clean DB');
    await cleanDB();
  } catch (error) {
    console.error(error.message);
    console.error(lsql);
  }

  await destruct();
})();
