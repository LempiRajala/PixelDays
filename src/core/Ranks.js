/*
 * timers and cron for account related actions
 */

import { populateIdObj } from '../data/sql/User.js';
import {
  getRanks,
  resetDailyRanks,
  getPrevTop,
  getOnlineUserStats,
  storeOnlinUserAmount,
  getCountryDailyHistory,
  getCountryRanks,
  getHourlyCountryStats,
  storeHourlyCountryStats,
  getTopDailyHistory,
  storeHourlyPixelsPlaced,
  getHourlyPixelStats,
  getDailyPixelStats,
} from '../data/redis/ranks.js';
import {
  getAllCountryCooldownFactors,
  resetCountryCooldownFactor,
  setCountryCooldownFactor,
} from './CooldownModifiers.js';
import socketEvents from '../socket/socketEvents.js';
import logger from './logger.js';

import { MINUTE } from './constants.ts';
import { PUNISH_DOMINATOR } from './config.js';
import { DailyCron, HourlyCron } from '../utils/cron.js';

class Ranks {
  ranks = {
    // ranking today of users by pixels
    dailyRanking: [],
    // ranking of users by pixels
    ranking: [],
    // ranking today of countries by pixels
    dailyCRanking: [],
    // ranking hourly of countries by pixels
    cHourlyStats: [],
    // yesterdays ranking of users by pixels
    prevTop: [],
    // online user amount by hour
    onlineStats: [],
    // ranking of countries by day
    cHistStats: [],
    // ranking of users by day
    histStats: { users: [], stats: [] },
    // pixels placed by hour
    pHourlyStats: [],
    // pixels placed by day
    pDailyStats: [],
    // cooldown changes per country affected country
    cooldownChanges: {},
  };

  // if a country dominates, adjust its cooldown
  #punishedCountry = null;
  #punishmentFactor = 1.0;

  constructor() {
    /*
     * we go through socketEvents for sharding
     */
    socketEvents.on('rankingListUpdate', (rankings) => {
      this.#mergeIntoRanks(rankings);
    });
  }

  async initialize() {
    try {
      this.#mergeIntoRanks(await Ranks.dailyUpdateRanking());
      this.#mergeIntoRanks(await Ranks.hourlyUpdateRanking());
      await Ranks.updateRanking();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error initialize ranks: ${err.message}`);
    }
    setInterval(Ranks.updateRanking, 5 * MINUTE);
    HourlyCron.hook(Ranks.setHourlyRanking);
    DailyCron.hook(Ranks.setDailyRanking);
  }

  #mergeIntoRanks(newRanks) {
    if (!newRanks) {
      return;
    }
    if (newRanks.cHourlyStats) {
      this.setPunishments(newRanks.cHourlyStats);
    }
    this.ranks = {
      ...this.ranks,
      ...newRanks,
    };
  }

  /*
   * populate ranking list with userdata inplace, censor private users
   * @param ranks Array of rank objects with userIds
   * @return ranks Array
   */
  static async #populateRanking(ranks) {
    const popRanks = await populateIdObj(ranks);
    // remove data of private users
    return popRanks.map((rank) => (rank.name ? rank : {}));
  }


  setPunishments(cHourlyStats) {
    if (!cHourlyStats.length || !PUNISH_DOMINATOR) {
      return;
    }
    let newPunishedCountry = null;
    let newPunishmentFactor = 1.0;
    /*
     * don't punish when canvas has less than 50% of
     * daily peak activity
     */
    const { pHourlyStats } = this.ranks;
    let maxActivity = 0;
    pHourlyStats.slice(0, 24).forEach((e) => {
      if (e > maxActivity) {
        maxActivity = e;
      }
    });
    if (pHourlyStats[0] >= maxActivity * 0.5) {
      let outnumbered = 0;
      const { cc: leadingCountry } = cHourlyStats[0];
      let { px: margin } = cHourlyStats[0];
      for (let i = 1; i < cHourlyStats.length; i += 1) {
        margin -= cHourlyStats[i].px;
        if (margin < 0) {
          break;
        }
        outnumbered += 1;
      }
      /*
      * if the leading country places more pixels
      * than the fellowing 2+ countries after,
      * 20% gets added to their cooldown for every country
      * after the first. Ceiled at 200%
      */
      if (outnumbered > 2) {
        let punishmentFactor = 1 + 0.25 * (outnumbered - 2);
        if (punishmentFactor > 3) {
          punishmentFactor = 3;
        }
        newPunishedCountry = leadingCountry;
        newPunishmentFactor = punishmentFactor;
        logger.info(
          // eslint-disable-next-line max-len
          `Punishment for dominating country ${leadingCountry} of ${punishmentFactor}`,
        );
      }
    }

    if (this.#punishedCountry !== newPunishedCountry
      || this.#punishmentFactor !== newPunishmentFactor
    ) {
      if (this.#punishedCountry) {
        resetCountryCooldownFactor(this.#punishedCountry);
      }
      if (newPunishedCountry) {
        setCountryCooldownFactor(newPunishedCountry, newPunishmentFactor);
      }
      this.#punishedCountry = newPunishedCountry;
      this.#punishmentFactor = newPunishmentFactor;
    }
    this.ranks.cooldownChanges = getAllCountryCooldownFactors();
  }

  static async updateRanking() {
    // only main shard does it
    if (!socketEvents.important) {
      return null;
    }
    const ranking = await Ranks.#populateRanking(
      await getRanks(
        false,
        1,
        100,
      ));
    const dailyRanking = await Ranks.#populateRanking(
      await getRanks(
        true,
        1,
        100,
      ));
    const dailyCRanking = await getCountryRanks(1, 100);
    const ret = {
      ranking,
      dailyRanking,
      dailyCRanking,
    };
    socketEvents.rankingListUpdate(ret);
    return ret;
  }

  static async hourlyUpdateRanking() {
    const onlineStats = await getOnlineUserStats();
    const cHistStats = await getCountryDailyHistory();
    const pHourlyStats = await getHourlyPixelStats();
    const cHourlyStats = await getHourlyCountryStats(1, 100);
    const ret = {
      onlineStats,
      cHistStats,
      pHourlyStats,
      cHourlyStats,
    };
    if (socketEvents.important) {
      // only main shard sends to others
      socketEvents.rankingListUpdate(ret);
    }
    return ret;
  }

  static async dailyUpdateRanking() {
    const prevTop = await Ranks.#populateRanking(
      await getPrevTop(),
    );
    const pDailyStats = await getDailyPixelStats();
    const histStats = await getTopDailyHistory();
    const hisUsers = await Ranks.#populateRanking(histStats.users);
    histStats.users = hisUsers.filter((r) => r.name);
    histStats.stats = histStats.stats.map((day) => day.filter(
      (r) => histStats.users.some((u) => u.id === r.id),
    ));
    const ret = {
      prevTop,
      pDailyStats,
      histStats,
    };
    if (socketEvents.important) {
      // only main shard sends to others
      socketEvents.rankingListUpdate(ret);
    }
    return ret;
  }

  static async setHourlyRanking() {
    if (!socketEvents.important) {
      return;
    }
    const amount = socketEvents.onlineCounter.total;
    await storeOnlinUserAmount(amount);
    await storeHourlyPixelsPlaced();
    await storeHourlyCountryStats(1, 100);
    await Ranks.hourlyUpdateRanking();
  }

  /*
   * reset daily rankings, store previous rankings
   */
  static async setDailyRanking() {
    if (!socketEvents.important) {
      return;
    }
    logger.info('Resetting Daily Ranking');
    await resetDailyRanks();
    await Ranks.dailyUpdateRanking();
  }
}


export default new Ranks();
