/*
 * Events for WebSockets
 */
import EventEmitter from 'events';

import {
  dehydratePixelUpdate,
} from './packets/server.js';
import { DO_NOTHING } from '../core/constants.ts';

class SocketEvents extends EventEmitter {
  isCluster = false;
  // object with amount of online users
  // in total and per canvas
  onlineCounter;

  constructor() {
    super();
    /*
     * {
     *   total: totalUsersOnline,
     *  canvasId: onlineUsers,
     *  ...
     *  }
     */
    this.onlineCounter = {
      total: 0,
    };
    // array of IPs that are online
    this.onlineIPs = [];
  }

  // eslint-disable-next-line class-methods-use-this
  get important() {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  get lowestActiveShard() {
    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  async initialize() {
    // nothing, only for child classes
  }

  /*
   * async event
   */
  onAsync(evtString, cb) {
    this.on(evtString, (...args) => {
      setImmediate(() => {
        cb(...args);
      });
    });
  }

  /**
   * requests that expect a response
   * req(type, args) can be awaited
   * it will return a response from whatever listens on onReq(type, cb(args))
   * Keep the arguments serializable for shard support
   */
  req(type, ...args) {
    return new Promise((resolve, reject) => {
      const chan = Math.floor(Math.random() * 100000).toString()
        + Math.floor(Math.random() * 100000).toString();
      const chankey = `res:${chan}`;
      let id;
      const callback = (ret) => {
        clearTimeout(id);
        resolve(ret);
      };
      id = setTimeout(() => {
        this.off(chankey, callback);
        reject(new Error(`Timeout on req ${type}`));
      }, 45000);
      this.once(chankey, callback);
      this.emit(`req:${type}`, chan, ...args);
    });
  }

  /**
   * request for all shards that expect a response,
   * since we don't have shards here, it's the same as this.req()
   */
  reqAll(...args) {
    return this.req(...args);
  }

  onReq(type, cb) {
    this.on(`req:${type}`, async (chan, ...args) => {
      const ret = await cb(...args);
      if (ret === DO_NOTHING) {
        return;
      }
      this.emit(`res:${chan}`, ret);
    });
  }

  /**
   * broadcast pixel message via websocket
   * @param canvasId number ident of canvas
   * @param chunkid number id consisting of i,j chunk coordinates
   * @param pxls buffer with offset and color of one or more pixels
   */
  broadcastPixels(
    canvasId,
    chunkId,
    pixels,
  ) {
    const i = chunkId >> 8;
    const j = chunkId & 0xFF;
    const buffer = dehydratePixelUpdate(i, j, pixels);
    this.emit('pixelUpdate', canvasId, chunkId, buffer);
    this.emit('chunkUpdate', canvasId, [i, j]);
  }

  /**
   * chunk updates from event, image upload, etc.
   * everything that's not a pixelUpdate and changes chunks
   * @param canvasId
   * @param chunk [i,j] chunk coordinates
   */
  broadcastChunkUpdate(
    canvasId,
    chunk,
  ) {
    this.emit('chunkUpdate', canvasId, chunk);
  }

  /**
   * broadcast fetched IpInfo of user,
   * used to spread flag informations of users
   * to shards
   * @param userIpInfo object {
   *   userId, // 0 if not logged in
   *   status, // proxycheck and ban status (see core/isAllowed)
   *   ip,
   *   cidr,
   *   org,
   *   country,
   *   asn,
   *   descr,
   * }
   */
  gotUserIpInfo(userIpInfo) {
    this.emit('useripinfo', userIpInfo);
  }

  /**
   * ask other shards to send email for us,
   * only used when USE_MAILER is false
   * @param type type of mail to send
   * @param args
   */
  sendMail(...args) {
    this.emit('mail', ...args);
  }

  /**
   * received Chat message on own websocket, will be consumed by chatProvider
   * and then send by sendMessage
   * @param user user object
   * @param ip ip object
   * @param message text message
   * @param channelId numerical channel id
   * @param lang language code
   * @param ttag ttag instance to be able to send localized error messages
   */
  recvChatMessage(user, ip, message, channelId, lang, ttag) {
    this.emit('recvChatMessage', user, ip, message, channelId, lang, ttag);
  }

  /**
   * set cooldownfactor
   * (used by RpgEvent)
   * @param fac factor by which cooldown changes globally
   */
  setCoolDownFactor(fac) {
    this.emit('setCoolDownFactor', fac);
  }

  /**
   * broadcast chat message to all users in channel
   * @param name chatname
   * @param message Message to send
   * @param sendapi If chat message should get broadcasted to api websockets
   *                (useful if the api is supposed to not answer to its own messages)
   */
  broadcastChatMessage(
    name,
    message,
    channelId,
    id,
    country = 'xx',
    sendapi = true,
  ) {
    this.emit(
      'chatMessage',
      name,
      message,
      channelId,
      id,
      country || 'xx',
      sendapi,
    );
  }

  /**
   * send an announcmeent to all players
   * @param text can be markdown text
   */
  broadcastAnnouncement(text) {
    this.emit('announcement', text);
  }

  /**
   * send chat message to a single user in channel
   */
  broadcastSUChatMessage(
    targetUserId,
    name,
    message,
    channelId,
    id,
    country = 'xx',
  ) {
    this.emit(
      'suChatMessage',
      targetUserId,
      name,
      message,
      channelId,
      id,
      country || 'xx',
    );
  }

  /**
   * broadcast Assigning chat channel to user
   * @param userId numerical id of user
   * @param channelId numerical id of chat channel
   * @param channelArray array with channel info [name, type, lastTs]
   */
  broadcastAddChatChannel(
    userId,
    channelId,
    channelArray,
  ) {
    this.emit(
      'addChatChannel',
      userId,
      channelId,
      channelArray,
    );
  }

  /*
   * broadcast Removing chat channel from user
   * @param userId numerical id of user
   * @param channelId numerical id of chat channel
   *        (i.e. false if the user already gets it via api response)
   */
  broadcastRemoveChatChannel(
    userId,
    channelId,
  ) {
    this.emit('remChatChannel', userId, channelId);
  }

  /**
   * broadcast change of fonts used by captcha
   * @param fontFilenames Array of filenams
   */
  broadcastCaptchaFonts(fontFilenames) {
    this.emit('setCaptchaFonts', fontFilenames);
  }

  /**
   * trigger rate limit of ip
   * @param ip
   * @param blockTime in ms
   */
  broadcastRateLimitTrigger(ip, blockTime) {
    this.emit('rateLimitTrigger', ip, blockTime);
  }

  /**
   * broadcast ranking list updates
   * @param rankings {
   *   dailyRanking?: daily pixel raking top 100,
   *   ranking?: total pixel ranking top 100,
   *   prevTop?: top 10 of the previous day,
   * }
   */
  rankingListUpdate(rankings) {
    this.emit('rankingListUpdate', rankings);
  }

  /**
   * reload user / ip on websocket to get changes
   * @param local whether we only update server side, or if we tell the client
   *   to update es well
   */
  reloadUser(userId, local) {
    this.emit('reloadUser', userId, local);
  }

  reloadIP(ipString, local) {
    this.emit('reloadIP', ipString, local);
  }

  /**
   * receive information about online users
   * @param online {
   *     canvasId1: [IP1, IP2, IP2, ...],
   *     ...
   *   }
   */
  setOnlineUsers(onlineData) {
    const newOnlineCounter = {};
    const newOnlineIPs = [];
    for (const [canvasId, ipList] of Object.entries(onlineData)) {
      newOnlineCounter[canvasId] = ipList.length;
      for (const ip of ipList) {
        if (!newOnlineIPs.includes(ip)) {
          newOnlineIPs.push(ip);
        }
      }
    }
    newOnlineCounter.total = newOnlineIPs.length;
    this.onlineCounter = newOnlineCounter;
    this.onlineIPs = newOnlineIPs;

    this.broadcastOnlineCounter();
  }

  /*
   * broadcast online counter
   */
  broadcastOnlineCounter() {
    this.emit('onlineCounter', this.onlineCounter);
  }

  /**
   * change cooldown of specific ip temporary
   * @param ip ip string
   * @param factor factor to multiple cooldown with
   * @param endTime timestamp until which the modifier applies
   */
  broadcastIPCooldownModifier(ip, factor, endTime) {
    this.emit('ipCooldownModifier', ip, factor, endTime);
  }

  /**
   * update shared state (see core/SharedState.js), this can
   * be a partial state, that will then be merged together
   * @param state shared state
   */
  updateSharedState(state) {
    this.emit('sharedstate', state);
  }

  /**
   * make fish appear for a user of specific IP
   * @param ip ip as a string
   * @param type number of fish type
   * @param size size of fish in kg
   */
  sendFish(ip, type, size) {
    this.emit('sendFish', ip, type, size);
  }

  /**
   * register caught fish for storing in database and cooldown modifier
   */
  registerCatchedFish(user, ip, type, size) {
    this.emit('registerCatchedFish', user, ip, type, size);
  }

  /**
   * broadcast caught fish to all connections of ip
   */
  catchedFish(user, ip, type, size) {
    this.emit('catchedFish', user, ip, type, size);
  }
}

export default SocketEvents;
