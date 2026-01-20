/*
 * sends messages to other ppfun instances
 * to work as cluster
 * If methods have no descriptions, they can be checked in ./SockEvents.js
 *
 * Subscribed PUB/SUB Channels:
 *   'bc': text broadcast channel for everyone
 *   'l:[thisShardName]': text channel specific shards are listening too
 *   '[otherShardName]': of every single other shard, where they send binary
 */

import SocketEvents from './SockEvents.js';
import {
  ONLINE_COUNTER_OP,
  PIXEL_UPDATE_MB_OP,
  CHUNK_UPDATE_MB_OP,
} from './packets/op.js';
import {
  hydrateOnlineCounter,
  hydratePixelUpdateMB,
  hydrateChunkUpdateMB,
  dehydratePixelUpdate,
  dehydratePixelUpdateMB,
  dehydrateChunkUpdateMB,
} from './packets/server.js';
import { pubsub } from '../data/redis/client.js';
import { combineObjects } from '../core/utils.js';
import { DO_NOTHING } from '../core/constants.ts';

/*
 * channel that all shards share and listen to
 */
const BROADCAST_CHAN = 'bc';
/*
 * prefix of channel that a specific shard listens to,
 * for receiving targeted messages
 */
const LISTEN_PREFIX = 'l';
/*
 * channel where only one shard sends to is the name
 * of the shard and has no prefix
 */


class MessageBroker extends SocketEvents {
  isCluster = true;
  thisShard = Math.random().toString(36).substring(2, 10);
  /*
   * When we announce our existence to others, we use the shardName and
   * a random existenceId.
   * This has the purpose to detect the unlikely case of a duplicate shartName.
   */
  existenceId = null;
  /*
   * channel keepalive pings
   * { [channelName]: lastPingTimestamp }
   */
  pings = {};
  /*
   * all other shards
   * { [shardName]: lastBroadcastTimestamp, ... }
   */
  shards = {};
  /*
   * online counter of all shards including ourself
   * [
   *   [shardName, amountOnlineIps, {canvasId1: [IP1, IP2, ...], ...}],
   *   ...,
   * }
   */
  shardsData = [];

  publisher = {
    publish: () => {},
  };

  subscriber = {
    subscribe: () => {},
    unsubscribe: () => {},
  };

  constructor() {
    super();
    this.checkHealth = this.checkHealth.bind(this);
    this.onShardBCMessage = this.onShardBCMessage.bind(this);
    this.onShardListenMessage = this.onShardListenMessage.bind(this);

    setInterval(this.checkHealth, 10000);
  }

  get important() {
    /*
     * important main shard does tasks like running RpgEvent
     * or updating rankings
     */
    return !this.shardsData[0]
      || this.shardsData[0][0] === this.thisShard;
  }

  get lowestActiveShard() {
    let lowest = 0;
    let lShard = null;
    this.shardsData.forEach((shardData) => {
      const [shard, cnt] = shardData;
      if (cnt < lowest || !lShard) {
        lShard = shard;
        lowest = cnt;
      }
    });
    return lShard || this.thisShard;
  }

  async initialize() {
    this.publisher = pubsub.publisher;
    this.subscriber = pubsub.subscriber;
    await this.connectShardChannel();
    await this.connectBCChannel();
    // give other shards 25s to announce themselves
    await new Promise((resolve) => {
      setTimeout(resolve, 25000);
    });
    console.log('CLUSTER: Initialized message broker');
  }

  announceExistence() {
    /*
     * to avoid collisions on package loss, reuse existing if not resolved
     * already
     */
    this.existenceId = this.existenceId
      || Math.random().toString(36).substring(2, 10);
    this.publisher.publish(BROADCAST_CHAN,
      `${this.thisShard}:exists,${this.existenceId}`,
    );
  }

  async connectBCChannel() {
    await this.subscriber.subscribe(BROADCAST_CHAN, this.onShardBCMessage);
    this.announceExistence();
    this.pings[BROADCAST_CHAN] = Date.now();
  }

  async connectShardChannel() {
    const channel = `${LISTEN_PREFIX}:${this.thisShard}`;
    await this.subscriber.subscribe(channel, this.onShardListenMessage);
    this.pings[channel] = Date.now();
  }

  async rerollShardName() {
    const oldShardChannel = `${LISTEN_PREFIX}:${this.thisShard}`;
    await this.subscriber.unsubscribe(oldShardChannel);
    delete this.pings[oldShardChannel];
    this.thisShard = Math.random().toString(36).substring(2, 10);
    await this.connectShardChannel();
    this.announceExistence();
    console.log(`CLUSTER: Renamed shard to: ${this.thisShard}`);
  }

  /*
   * messages on shared broadcast channels that every shard is listening to
   */
  async onShardBCMessage(message) {
    try {
      const curTime = Date.now();
      /*
       * messages in the form of 'shard:type,JSONArrayData'
       */
      const comma = message.indexOf(',');
      const colon = message.indexOf(':');
      const shardName = message.slice(0, colon);
      const key = message.slice(colon + 1, comma);
      let val = message.slice(comma + 1);
      /*
        * shards announcing their existence
        */
      if (key === 'exists') {
        if (shardName === this.thisShard) {
          if (this.existenceId && val !== this.existenceId) {
            console.error(`CLUSTER: Error CLASHING SHARD NAMES: ${val}`);
            this.rerollShardName();
            return;
          }
          this.pings[BROADCAST_CHAN] = curTime;
          this.existenceId = null;
        } else {
          /*
            * other shards
            */
          if (!this.shards[shardName]) {
            console.log(`CLUSTER: Shard ${shardName} connected`);
            await this.subscriber.subscribe(
              shardName,
              (buffer) => this.onShardBinaryMessage(buffer, shardName),
              true,
            );
            // immediately give new shards information
            this.announceExistence();
          }
          this.pings[shardName] = curTime;
          this.shards[shardName] = curTime;
        }
        return;
      }
      if (shardName === this.thisShard) {
        return;
      }
      val = JSON.parse(val);
      /*
        * online data update of shard
        */
      if (key === 'onlineShardData') {
        this.updateShardOnlineData(shardName, ...val);
        return;
      }
      /*
        * emit as socket event
        */
      super.emit(key, ...val);
    } catch (err) {
      console.error(`CLUSTER: Error on broadcast message: ${err.message}`);
    }
  }

  /**
   * messages on shard specific listener channel
   * messages in form `type,JSONArrayData`
   * straight emitted as socket event
   */
  async onShardListenMessage(message) {
    try {
      if (message === 'ping') {
        const channel = `${LISTEN_PREFIX}:${this.thisShard}`;
        this.pings[channel] = Date.now();
        return;
      }
      const comma = message.indexOf(',');
      const key = message.slice(0, comma);
      console.log(`CLUSTER shard listener got ${key}`);
      const val = JSON.parse(message.slice(comma + 1));
      super.emit(key, ...val);
    } catch (err) {
      console.error(`CLUSTER: Error on listener message: ${err.message}`);
    }
  }

  /*
   * this function is euqal to the one it overloads,
   * whith the only addition of emmiting the shardName
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
      this.emit(`req:${type}`, chan, this.thisShard, ...args);
    });
  }

  /*
   * requests that go over all shards and combine responses from all
   */
  reqAll(type, ...args) {
    return new Promise((resolve, reject) => {
      const chan = Math.floor(Math.random() * 100000).toString()
        + Math.floor(Math.random() * 100000).toString();
      const chankey = `res:${chan}`;
      let id;
      let amountOtherShards = this.shardsData.length;
      let ret = null;
      const callback = (retn) => {
        amountOtherShards -= 1;
        ret = combineObjects(ret, retn);
        if (amountOtherShards <= 0) {
          console.log(`CLUSTER res:${chan}:${type} finished`);
          this.off(chankey, callback);
          clearTimeout(id);
          resolve(ret);
        } else {
          // eslint-disable-next-line
          console.log(`CLUSTER got res:${chan}:${type} from shard, ${amountOtherShards} still left`);
        }
      };
      id = setTimeout(() => {
        this.off(chankey, callback);
        if (ret) {
          resolve(ret);
        } else {
          reject(new Error(`CLUSTER Timeout on wait for res:${chan}:${type}`));
        }
      }, 25000);
      this.on(chankey, callback);
      this.emit(`req:${type}`, chan, this.thisShard, ...args);
    });
  }

  onReq(type, cb) {
    this.on(`req:${type}`, async (chan, shardName, ...args) => {
      const ret = await cb(...args);
      if (ret === DO_NOTHING) {
        return;
      }
      if (shardName === this.thisShard) {
        super.emit(`res:${chan}`, ret);
      } else {
        this.publisher.publish(
          `${LISTEN_PREFIX}:${shardName}`,
          `res:${chan},${JSON.stringify([ret])}`,
        );
      }
    });
  }

  updateShardOnlineData(shard, onlineData) {
    let amountOnlineIPs = 0;
    for (const ipList of Object.values(onlineData)) {
      amountOnlineIPs += ipList.length;
    }

    const shardCounter = this.shardsData.find(
      (c) => c[0] === shard,
    );
    if (!shardCounter) {
      this.shardsData.push([shard, amountOnlineIPs, onlineData]);
      this.shardsData.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      shardCounter[1] = amountOnlineIPs;
      shardCounter[2] = onlineData;
    }
    this.sumOnlineCounters();
  }

  removeShardFromOnlineData(shard) {
    const counterIndex = this.shardsData.findIndex(
      (c) => c[0] === shard,
    );
    if (~counterIndex) {
      this.shardsData.splice(counterIndex, 1);
    }
  }

  /*
   * messages on binary shard channels, where specific shards send from
   */
  onShardBinaryMessage(buffer, shard) {
    try {
      const opcode = buffer[0];
      switch (opcode) {
        case PIXEL_UPDATE_MB_OP: {
          const puData = hydratePixelUpdateMB(buffer);
          super.emit('pixelUpdate', ...puData);
          const chunkId = puData[1];
          const chunk = [chunkId >> 8, chunkId & 0xFF];
          super.emit('chunkUpdate', puData[0], chunk);
          break;
        }
        case CHUNK_UPDATE_MB_OP: {
          super.emit('chunkUpdate', ...hydrateChunkUpdateMB(buffer));
          break;
        }
        case ONLINE_COUNTER_OP: {
          const cnt = hydrateOnlineCounter(buffer);
          this.updateShardOnlineData(shard, cnt);
          // use online counter as ping for binary shard channel
          this.pings[shard] = Date.now();
          break;
        }
        default:
          // nothing
      }
    } catch (err) {
      // eslint-disable-next-line max-len
      console.error(`CLUSTER: Error on binary message of shard ${shard}: ${err.message}`);
    }
  }

  /*
   * create onlineCounter object out of shardsData
   */
  sumOnlineCounters() {
    const newOnlineCounter = {};
    const newOnlineIPs = [];

    const onlineDataSum = {};
    this.shardsData.forEach((shardData) => {
      for (const [canvasId, ipList] of Object.entries(shardData[2])) {
        const ipListSum = onlineDataSum[canvasId];
        if (ipListSum) {
          for (const ip of ipList) {
            if (!ipListSum.includes(ip)) {
              ipListSum.push(ip);
            }
          }
        } else {
          onlineDataSum[canvasId] = [...ipList];
        }
      }
    });

    for (const [canvasId, ipList] of Object.entries(onlineDataSum)) {
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
  }

  /*
   * intercept all events and distribute them to others
   */
  emit(key, ...args) {
    super.emit(key, ...args);
    const msg = `${this.thisShard}:${key},${JSON.stringify(args)}`;
    this.publisher.publish(BROADCAST_CHAN, msg);
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
    this.publisher.publish(
      this.thisShard,
      dehydratePixelUpdateMB(canvasId, i, j, pixels),
    );
    const buffer = dehydratePixelUpdate(i, j, pixels);
    super.emit('pixelUpdate', canvasId, chunkId, buffer);
    super.emit('chunkUpdate', canvasId, [i, j]);
  }

  setCoolDownFactor(fac) {
    if (this.important) {
      this.emit('setCoolDownFactor', fac);
    } else {
      super.emit('setCoolDownFactor', fac);
    }
  }

  /*
   * not serializable, will be consumed by ChatProvider and then broadcasted
   * with sendMessage
   */
  recvChatMessage(user, ip, message, channelId, lang, ttag) {
    super.emit('recvChatMessage', user, ip, message, channelId, lang, ttag);
  }

  broadcastChunkUpdate(
    canvasId,
    chunk,
  ) {
    this.publisher.publish(
      this.thisShard,
      dehydrateChunkUpdateMB(canvasId, chunk),
    );
    super.emit('chunkUpdate', canvasId, chunk);
  }

  /*
   * receive information about online users
   * @param online Object with information of online users
   *   {
   *     canvasId1: [IP1, IP2, IP2, ...],
   *     ...
   *   }
   */
  setOnlineUsers(onlineData) {
    this.updateShardOnlineData(this.thisShard, onlineData);
    this.emit('onlineShardData', onlineData);
    super.emit('onlineCounter', this.onlineCounter);
  }

  async checkHealth() {
    const threshold = Date.now() - 30000;
    const { shards, pings } = this;
    try {
      // remove disconnected shards
      for (const [shard, timeLastPing] of Object.entries(shards)) {
        if (timeLastPing < threshold) {
          console.log(`CLUSTER: Shard ${shard} disconnected`);
          this.removeShardFromOnlineData(shard);
          // eslint-disable-next-line no-await-in-loop
          await this.subscriber.unsubscribe(shard);
          delete pings[shard];
          delete shards[shard];
        }
      }
      // check for disconnected redis channels
      for (const [channel, timeLastPing] of Object.entries(pings)) {
        if (timeLastPing < threshold) {
          // eslint-disable-next-line no-await-in-loop
          await this.subscriber.unsubscribe(channel);
          delete pings[channel];
          if (channel === BROADCAST_CHAN) {
            console.warn('CLUSTER: Broadcaset channel broken, reconnect');
            // eslint-disable-next-line no-await-in-loop
            await this.connectBCChannel();
          } else if (channel.startsWith(`${LISTEN_PREFIX}:`)) {
            console.warn('CLUSTER: Shard text channel broken, reconnect');
            // eslint-disable-next-line no-await-in-loop
            await this.connectShardChannel();
          } else {
            console.warn(`CLUSTER: Binary channel to shard ${channel} broken`);
            // will connect again on next broadcast of shard
            this.removeShardFromOnlineData(channel);
            delete shards[channel];
          }
        }
      }
    } catch (err) {
      console.error(`CLUSTER: Error on health check: ${err.message}`);
    }
    // send keep alive to others
    this.announceExistence();
    // ping to own text listener channel
    this.publisher.publish(`${LISTEN_PREFIX}:${this.thisShard}`, 'ping');
  }

  /**
   * make fish appear for a user of specific IP, connection
   * needs to be chosen randomly
   * @param ip ip as a string
   * @param type number of fish type
   * @param size size of fish in kg
   */
  sendFish(ip, type, size) {
    const shardsWithIp = [];
    for (const [shardName,, onlineData] of this.shardsData) {
      for (const ipList of Object.values(onlineData)) {
        if (ipList.includes(ip)) {
          shardsWithIp.push(shardName);
          break;
        }
      }
    }
    const shardName = shardsWithIp[
      Math.floor(Math.random() * shardsWithIp.length)
    ];
    if (shardName === this.thisShard) {
      super.emit('sendFish', ip, type, size);
    } else {
      this.publisher.publish(
        `${LISTEN_PREFIX}:${shardName}`,
        `sendFish,${JSON.stringify([ip, type, size])}`,
      );
    }
  }

  /*
   * registering caught fish only happens on one shard
   */
  registerCatchedFish(user, ip, type, size) {
    super.emit('registerCatchedFish', user, ip, type, size);
  }
}

export default MessageBroker;
