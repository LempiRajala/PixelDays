/*
 * check if an ip is a proxy via proxycheck.io
 */

/* eslint-disable max-classes-per-file */

import { HourlyCron } from '../cron.js';

const HYSTERESIS = 60;

type KeyType = [
  string,
  number,
  number,
  number,
  boolean,
];

type ProxyCheckIPResponse = {
  status: "ok" | "warning" | "denied" | "error";
} & {
  [ip: string]: {
    proxy: "yes" | "no";
    type?: "VPN" | "TOR" | "PUBLIC" | "WEB" | "HTTP" | "SOCKS4" | "SOCKS5" | "DNS" | "SPAM";
    error: string;
    operator?: {
      name: string;
    };
    city?: string;
    devices?: {
      address: string;
      subnet: string;
    };
  };
}

type ProxyCheckResult = {
  [ip: string]: {
    proxy: "yes" | "no";
    type?: "VPN" | "TOR" | "PUBLIC" | "WEB" | "HTTP" | "SOCKS4" | "SOCKS5" | "DNS" | "SPAM";
    error: string;
    operator?: {
      name: string;
    };
    city?: string;
    devices?: {
      address: string;
      subnet: string;
    };
  } | {
    proxy: 'yes',
    type: 'Invalid IP',
    disposable: 'yes',
    // operator: undefined;
    // city: undefined;
    // devices: undefined;
  };
} 

/*
 * class to serve proxycheck.io key
 * One paid account is allowed to have one additional free account,
 * which is good for fallback, if something goes wrong
 */
class PcKeyProvider {
  private logger: Console;
  private availableKeys: KeyType[];
  private disabledKeys: KeyType[];

  /*
   * @param pcKeys list of keys
   */
  constructor(pcKeys: string[], logger: Console) {
    if (!logger) logger = console;
    if (!pcKeys.length) {
      logger.info('You have to define PROXYCHECK_KEY to use proxycheck.io');
    }
    this.updateKeys = this.updateKeys.bind(this);
    /*
     * [
     *   [
     *     key,
     *     availableQueries: how many queries still available today,
     *     dailyLimit: how many queries available for today,
     *     burstAvailable: how many burst tokens available,
     *     denied: if key got denied
     *   ],..
     * ]
     */
    this.availableKeys = [];
    this.disabledKeys = [];
    this.logger = logger;
    this.getKeysUsage(pcKeys);
    HourlyCron.hook(this.updateKeys);
  }

  /*
   * @return random available pcKey
   * disable key if close to daily limit
   */
  public getKey() {
    const { availableKeys: keys } = this;
    while (keys.length) {
      const pos = Math.floor(Math.random() * keys.length);
      const keyData = keys[pos];
      const availableQueries = keyData[1] - 1;
      if (availableQueries >= HYSTERESIS) {
        keyData[1] = availableQueries;
        return keyData[0];
      }
      // eslint-disable-next-line max-len
      this.logger.warn(`PCKey: ${keyData[0]} close to daily limit, disabling it`);
      keys.splice(pos, 1);
      this.disabledKeys.push(keyData);
    }
    return this.enableBurst();
  }

  /*
   * select one available disabled key that is at daily limit and re-enabled it
   * to overuse it times 5
   */
  enableBurst() {
    const keyData = this.disabledKeys.find((k) => !k[4] && k[3] > 0);
    if (!keyData) {
      return null;
    }
    this.logger.info(`PCKey: ${keyData[0]}, using burst`);
    const pos = this.disabledKeys.indexOf(keyData);
    this.disabledKeys.splice(pos, 1);
    keyData[1] += keyData[2] * 4;
    keyData[2] *= 5;
    this.availableKeys.push(keyData);
    return keyData[0];
  }

  /*
   * get usage data of array of keys and put them into available / disabledKeys
   * @param keys Array of key strings
   */
  async getKeysUsage(keys: (string | KeyType)[]) {
    const tmpKeys = [...keys];
    for (let i = 0; i < tmpKeys.length; i += 1) {
      let key = tmpKeys[i];
      if (typeof key !== 'string') {
        [key] = key;
      }
      // eslint-disable-next-line no-await-in-loop
      await this.getKeyUsage(key);
    }
  }

  /*
   * get usage data of key and put him into availableKeys or disabledKeys
   * @param key string
   */
  async getKeyUsage(key: string) {
    let usage;
    try {
      try {
        usage = await PcKeyProvider.requestKeyUsage(key);
      } finally {
        let pos = this.availableKeys.findIndex((k) => k[0] === key);
        if (~pos) this.availableKeys.splice(pos, 1);
        pos = this.disabledKeys.findIndex((k) => k[0] === key);
        if (~pos) this.disabledKeys.splice(pos, 1);
      }
    } catch (err: any) {
      this.logger.info(`PCKey: ${key}, Error ${err.message}`);
      this.disabledKeys.push([
        key,
        0,
        0,
        0,
        true,
      ]);
      return;
    }
    const queriesToday = Number(usage['Queries Today']) || 0;
    const availableBurst = Number(usage['Burst Tokens Available']) || 0;
    const burstActive = Number(usage['Burst Token Active']) === 1;
    let dailyLimit = Number(usage['Daily Limit']) || 0;
    if (burstActive) {
      dailyLimit *= 5;
    }
    const availableQueries = dailyLimit - queriesToday;
    // eslint-disable-next-line max-len
    this.logger.info(`PCKey: ${key}, Queries Today: ${availableQueries} / ${dailyLimit} (Burst: ${availableBurst}, ${burstActive ? 'active' : 'inactive'})`);
    const keyData: KeyType = [
      key,
      availableQueries,
      dailyLimit,
      availableBurst,
      false,
    ];
    if (availableQueries > HYSTERESIS) {
      /*
       * data is a few minutes old, stop at HYSTERESIS
       */
      this.availableKeys.push(keyData);
    } else {
      this.disabledKeys.push(keyData);
    }
  }

  /*
   * query the API for limits
   * @param key
   */
  private static async requestKeyUsage(key: string) {
    const res = await fetch(`https://proxycheck.io/dashboard/export/usage/?key=${key}`);
    if (res.status !== 200) {
      throw new Error(`Status not 200: ${res.status}`);
    }

    return await res.json();
  }

  /*
   * report denied key (over daily quota, rate limited, blocked,...)
   * @param key
   */
  public denyKey(key: string) {
    const { availableKeys: keys } = this;
    const pos = keys.findIndex((k) => k[0] === key);
    if (~pos) {
      const keyData = keys[pos];
      keyData[4] = true;
      keys.splice(pos, 1);
      this.disabledKeys.push(keyData);
    }
  }

  /*
   * allow all denied keys again
   */
  async updateKeys() {
    await this.getKeysUsage(this.availableKeys);
    await this.getKeysUsage(this.disabledKeys);
  }
}

class ProxyCheck {
  private readonly queue: [string, Function][] = [];
  private readonly logger: Console;
  private fetching = false;
  private pcKeyProvider: PcKeyProvider;

  constructor(pcKeys: string[], logger?: Console) {
    if (!logger) logger = console;
    /*
     * queue of ip-checking tasks
     * [[ip, callbackFunction],...]
     */
    this.checkFromQueue = this.checkFromQueue.bind(this);
    this.checkIp = this.checkIp.bind(this);
    this.checkEmail = this.checkEmail.bind(this);
    this.pcKeyProvider = new PcKeyProvider(pcKeys, logger);
    this.logger = logger;
  }

  private reqProxyCheck(ips: string[]) {
    return new Promise<ProxyCheckResult>(async (resolve, reject) => {
      const key = this.pcKeyProvider.getKey();
      if (!key) {
        setTimeout(
          () => reject(new Error('No pc key available')),
          2000,
        );
        return;
      }

      let proxycheckResponse: ProxyCheckIPResponse;
      const postData = `ips=${ips.join(',')}`;
      try {
        const res = await fetch(`https://proxycheck.io/v2/?vpn=1&asn=1&key=${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData).toString(),
          },
          body: postData,
          signal: AbortSignal.timeout(30e3),
        });
        if (res.status !== 200) {
          throw new Error(`Status not 200: ${res.status}`);
        }

        proxycheckResponse = await res.json();
      } catch(e) {
        reject(e);
        return;
      }

      const { status: _, ...onlyChecks } = proxycheckResponse;
      const result: ProxyCheckResult = {};
      try {
        if (proxycheckResponse.status !== 'ok') {
          if (proxycheckResponse.status === 'error' && ips.length === 1) {
            /*
             * invalid ip, like a link local address
             * Error is either thrown in the top, when requesting only one ip
             * or in the ip-part as "error": "No valid.." when multiple
             * */
            resolve({
              [ips[0]]: {
                proxy: 'yes',
                type: 'Invalid IP',
                disposable: 'yes',
              },
            });
            return;
          }
          if (proxycheckResponse.status === 'denied') {
            this.pcKeyProvider.denyKey(key);
          }
          if (proxycheckResponse.status !== 'warning') {
            throw new Error(`${key}: ${proxycheckResponse.message}`);
          } else {
            this.logger.warn(`Warning: ${key}: ${proxycheckResponse.message}`);
          }
        }
        ips.forEach((ip) => {
          const ipCheckResult = proxycheckResponse[ip];
          if (ipCheckResult && ipCheckResult.error) {
            result[ip] = {
              proxy: 'yes',
              type: 'Invalid IP',
              disposable: 'yes',
            };
          } else {
            result[ip] = ipCheckResult;
          }
        });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async checkFromQueue() {
    const { queue } = this;
    if (!queue.length) {
      this.fetching = false;
      return;
    }
    this.fetching = true;
    const tasks = queue.slice(0, 50);
    const values = tasks.map((i) => i[0]);
    let res: ProxyCheckResult = {};
    try {
      res = await this.reqProxyCheck(values);
    } catch (err: any) {
      this.logger.error(`Error: ${err.message}`);
    }
    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];

      const pos = queue.indexOf(task);
      if (~pos) queue.splice(pos, 1);

      const [value, cb] = task;

      if (~value.indexOf('@')) {
        // email check
        let disposable = null;

        if (res[value]) {
          this.logger.info(`Email ${value}: ${JSON.stringify(res[value])}`);
          disposable = 'disposable' in res[value] && res[value].disposable === 'yes';
        }

        cb(disposable);
      } else {
        // ip check
        // eslint-disable-next-line no-lonely-if
        if (res[value]) {
          this.logger.info(`IP ${value}: ${JSON.stringify(res[value])}`);
          const result = res[value];
          cb({
            isProxy: result.proxy !== 'no',
            type: result.type || null,
            operator: 'operator' in result ? result.operator?.name || null : null,
            city: 'city' in result ? result.city || null : null,
            devices: 'devices' in result ? result.devices?.address || 1 : 1,
            subnetDevices: 'devices' in result ? result.devices?.subnet || 1 : 1,
          });
        } else {
          this.logger.error(`IP ${value} could not be checked for proxy.`);
          cb(null);
        }
      }
    }
    setTimeout(this.checkFromQueue, 10);
  }

  /**
   * check if ip is proxy in queue
   * @param ip as string
   * @return Promise null | {
   *   isProxy: true or false,
   *   type: Residential, Wireless, VPN, SOCKS,...,
   *   operator: name of proxy operator if available,
   *   city: name of city,
   *   devices: amount of devices using this ip,
   *   subnetDevices: amount of devices in this subnet,
   * }
   */
  public checkIp(ip: string) {
    return new Promise((resolve) => {
      this.queue.push([ip, resolve]);
      if (!this.fetching) {
        this.checkFromQueue();
      }
    });
  }

  /**
   * same as for ip
   * @param email
   * @return Promise that resolves to
   *  null: failure
   *  false: is legit provider
   *  true: is disposable provider
   */
  public checkEmail(email: string) {
    return new Promise((resolve) => {
      this.queue.push([email, resolve]);
      if (!this.fetching) {
        this.checkFromQueue();
      }
    });
  }
}

export default ProxyCheck;
