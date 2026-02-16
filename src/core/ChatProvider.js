/*
 * class for chat communications
 */
import logger from './logger.js';
import RateLimiter from '../utils/RateLimiter.js';
import { USERLVL } from '../data/sql/index.js';
import { findIdByNameOrId, getDummyUser } from '../data/sql/User.js';
import { getDefaultChannel } from '../data/sql/Channel.js';
import ChatMessageBuffer from './ChatMessageBuffer.js';
import socketEvents from '../socket/socketEvents.js';
import { ban, unban } from './ban.js';
import {
  mutec, unmutec,
  unmutecAll, listMutec,
  isCountryMuted,
} from '../data/redis/chat.js';
import { escapeMd } from './utils.js';
import mapFlag from '../utils/flagMapping.js';
import ttags from '../middleware/ttag.js';

import { USE_MAILER } from './config.js';
import {
  CHAT_CHANNELS,
  EVENT_USER_NAME,
  INFO_USER_NAME,
  APISOCKET_USER_NAME,
} from './constants.ts';

function getUserFromMd(mdUserLink) {
  let mdUser = mdUserLink.trim();
  if (mdUser[0] === '@') {
    mdUser = mdUser.substring(1);
    if (mdUser[0] === '[' && mdUser[mdUser.length - 1] === ')') {
      // if mdUser ping, select Id
      mdUser = mdUser.substring(
        mdUser.lastIndexOf('(') + 1, mdUser.length - 1,
      ).trim();
    }
  }
  return mdUser;
}

export class ChatProvider {
  constructor() {
    this.defaultChannels = {};
    this.langChannels = {};
    this.publicChannelIds = [];
    this.enChannelId = 0;
    this.infoUserId = 1;
    this.eventUserId = 1;
    this.autobanPhrase = null;
    this.apiSocketUserId = 1;
    this.caseCheck = /^[A-Z !.]*$/;
    this.cyrillic = /[\u0436-\u043B]'/;
    this.substitutes = [
      {
        regexp: /http[s]?:\/\/(old.)?pixeldays\.ru\/#/g,
        replace: '#',
      },
    ];
    this.chatMessageBuffer = new ChatMessageBuffer(socketEvents);

    /**
     * when a chat message gets sent by a user on this shard
     * @param user user object
     * @param ip ip object
     * @param message text message
     * @param channelId channel id
     * @param lang language code
     * @param ttag ttag instance
     */
    socketEvents.on('recvChatMessage', async (
      user, ip, message, channelId, lang, ttag,
    ) => {
      const errorMsg = await this.sendMessage(
        user, ip, message, channelId, lang, ttag,
      );
      if (errorMsg) {
        socketEvents.broadcastSUChatMessage(
          user.id,
          'info',
          errorMsg,
          channelId,
          this.infoUserId,
          'il',
        );
      }
    });
  }

  async initialize() {
    // find or create default channels
    for (let i = 0; i < CHAT_CHANNELS.length; i += 1) {
      const { name } = CHAT_CHANNELS[i];
      // eslint-disable-next-line no-await-in-loop
      const channel = await getDefaultChannel(name);
      const { id, type, lastTs } = channel[0];
      if (name === 'en') {
        this.enChannelId = id;
      }
      this.defaultChannels[id] = [name, type, lastTs];
      this.publicChannelIds.push(id);
    }
    // find or create non-english lang channels
    const langs = Object.keys(ttags);
    for (let i = 0; i < langs.length; i += 1) {
      const name = langs[i];
      if (name === 'default') {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const channel = await getDefaultChannel(name);
      const { id, type, lastTs } = channel[0];
      this.langChannels[name] = { id, type, lastTs };
      this.publicChannelIds.push(id);
    }
    // find or create default users
    this.infoUserId = await getDummyUser(INFO_USER_NAME);
    this.eventUserId = await getDummyUser(EVENT_USER_NAME);
    this.apiSocketUserId = await getDummyUser(APISOCKET_USER_NAME);
  }

  getDefaultChannels(lang) {
    const langChannel = {};
    if (lang && lang !== 'en') {
      const { langChannels } = this;
      if (langChannels[lang]) {
        const {
          id, type, lastTs,
        } = langChannels[lang];
        langChannel[id] = [lang, type, lastTs];
      }
    }
    return {
      ...langChannel,
      ...this.defaultChannels,
    };
  }

  /**
   * check if a user has access to a channel
   * @param user user object
   * @param lang language code
   * @param cid channel id
   * @return boolean whether or not the user has access to this channel
   */
  userHasChannelAccess(user, lang, cid) {
    if (this.defaultChannels[cid]) {
      return true;
    }
    if (user?.hasChannel(cid)) {
      return true;
    }
    return !!(this.langChannels[lang]
      && this.langChannels[lang].id === cid);
  }

  getHistory(cid, limit = 30) {
    return this.chatMessageBuffer.getMessages(cid, limit);
  }

  async adminCommands(message, channelId, user) {
    // admin commands
    const cmdArr = message.split(' ');
    const cmd = cmdArr[0].substring(1);
    const args = cmdArr.slice(1);
    const initiator = `@[${escapeMd(user.name)}](${user.id})`;
    switch (cmd) {
      case 'mute': {
        const timeMin = Number(args.slice(-1));
        if (args.length < 2 || Number.isNaN(timeMin)) {
          return this.mute(
            getUserFromMd(args.join(' ')),
            {
              printChannel: channelId,
              initiator,
              muid: user.id,
            },
          );
        }
        return this.mute(
          getUserFromMd(args.slice(0, -1).join(' ')),
          {
            printChannel: channelId,
            initiator,
            duration: timeMin,
            muid: user.id,
          },
        );
      }

      case 'unmute':
        return this.unmute(
          getUserFromMd(args.join(' ')),
          {
            printChannel: channelId,
            initiator,
            muid: user.id,
          },
        );

      case 'mutec': {
        if (args[0]) {
          const cc = args[0].toLowerCase();
          const ret = await mutec(channelId, cc);
          if (ret === null) {
            return 'No legit country defined';
          }
          if (!ret) {
            return `Country ${cc} is already muted`;
          }
          if (ret) {
            this.broadcastChatMessage(
              'info',
              `Country ${cc} has been muted from this channel by ${initiator}`,
              channelId,
              this.infoUserId,
            );
          }
          return null;
        }
        return 'No country defined for mutec';
      }

      case 'unmutec': {
        if (args[0]) {
          const cc = args[0].toLowerCase();
          const ret = await unmutec(channelId, cc);
          if (ret === null) {
            return 'No legit country defined';
          }
          if (!ret) {
            return `Country ${cc} is not muted`;
          }
          this.broadcastChatMessage(
            'info',
            `Country ${cc} has been unmuted from this channel by ${initiator}`,
            channelId,
            this.infoUserId,
          );
          return null;
        }
        const ret = await unmutecAll(channelId);
        if (ret) {
          this.broadcastChatMessage(
            'info',
            `All countries unmuted from this channel by ${initiator}`,
            channelId,
            this.infoUserId,
          );
          return null;
        }
        return 'No country is currently muted from this channel';
      }

      case 'listmc': {
        const ccArr = await listMutec(channelId);
        if (ccArr.length) {
          return `Muted countries: ${ccArr}`;
        }
        return 'No country is currently muted from this channel';
      }

      case 'autoban': {
        if (args[0]) {
          this.autobanPhrase = args.join(' ');
          if (this.autobanPhrase === 'unset' || this.autobanPhrase.length < 5) {
            this.autobanPhrase = null;
          }
          return `Set autoban phrase on shard to ${this.autobanPhrase}`;
        }
        // eslint-disable-next-line
        if (this.autobanPhrase) {
          // eslint-disable-next-line
          return `Current autoban phrase on shard is ${this.autobanPhrase}, use "/autoban unset" to remove it`;
        }
        return 'Autoban phrase is currently not set on this shard';
      }

      default:
        return `Couldn't parse command ${cmd}`;
    }
  }

  /**
   * user sending a chat message
   * @param user User object
   * @param ip ip object
   * @param message string of message
   * @param channelId integer of channel
   * @param lang language code
   * @param ttag ttag instance for localized errors
   * @return error message if unsuccessful, otherwise null
   */
  async sendMessage(user, ip, message, channelId, lang, ttag) {
    const { id } = user;
    const { t } = ttag;
    const { name } = user.data;
    const { ipString, country } = ip;

    if (!user.rateLimiter) {
      user.rateLimiter = new RateLimiter(20, 15, true);
    }
    const waitLeft = user.rateLimiter.tick();
    if (waitLeft) {
      const waitTime = Math.floor(waitLeft / 1000);
      // eslint-disable-next-line max-len
      return t`You are sending messages too fast, you have to wait ${waitTime}s :(`;
    }

    if (!this.userHasChannelAccess(user, lang, channelId)) {
      return t`You don\'t have access to this channel`;
    }

    if (user.userlvl < USERLVL.MOD) {
      if (await isCountryMuted(country, channelId)) {
        return t`Your country is temporary muted from this chat channel`;
      }
    } else if (message.charAt(0) === '/') {
      return this.adminCommands(message, channelId, user);
    }

    // eslint-disable-next-line prefer-const
    let { isBanned, isMuted, isProxy, isWhitelisted } = await ip.getAllowance();
    if (!isBanned && !isMuted && !isProxy && !isWhitelisted) {
      ({ isBanned, isMuted } = await user.getAllowance());
    }
    if (!isWhitelisted) {
      if (isProxy) {
        return t`You can not send chat messages while using a proxy`;
      }
      if (isBanned) {
        return t`Can not chat while being banned`;
      }
      if (isMuted) {
        if (isMuted === true) {
          // eslint-disable-next-line max-len
          return t`You are permanently muted, join our guilded to appeal the mute`;
        }
        const ttl = Math.ceil((isMuted - Date.now()) / 1000);
        if (ttl > 120) {
          const timeMin = Math.round(ttl / 60);
          return t`You are muted for another ${timeMin} minutes`;
        }
        return t`You are muted for another ${ttl} seconds`;
      }
    }

    if (name.trim() === ''
      || (this.autobanPhrase && message.includes(this.autobanPhrase))
    ) {
      user.isBanned = true;
      /* this will both ban and mute */
      ban(ipString, id, null, true, true, 'CHATBAN');
      logger.info(`CHAT AUTOBANNED: ${ipString}`);
      return 'nope';
    }

    const displayCountry = mapFlag(user.id, user.userlvl, country);

    if (USE_MAILER && user.userlvl < USERLVL.VERIFIED) {
      return t`Your mail has to be verified in order to chat`;
    }

    for (let i = 0; i < this.substitutes.length; i += 1) {
      const substitute = this.substitutes[i];
      message = message.replace(substitute.regexp, substitute.replace);
    }

    if (message.length > 200) {
      // eslint-disable-next-line max-len
      return t`You can\'t send a message this long :(`;
    }

    if (message.match(this.cyrillic) && channelId === this.enChannelId) {
      return t`Please use int channel`;
    }

    if (user.last_message && user.last_message === message) {
      user.message_repeat += 1;
      if (user.message_repeat >= 4) {
        this.mute(id, { duration: 60, printChannel: channelId });
        user.message_repeat = 0;
        return t`Stop flooding.`;
      }
    } else {
      user.message_repeat = 0;
      user.last_message = message;
    }

    logger.info(
      `Received chat message ${message} from ${name} / ${ip.ipString}`,
    );
    this.broadcastChatMessage(
      name,
      message,
      channelId,
      id,
      displayCountry,
    );
    return null;
  }

  broadcastChatMessage(...args) {
    return this.chatMessageBuffer.broadcastChatMessage(...args);
  }

  async mute(nameOrId, opts) {
    const timeMin = opts.duration || null;
    const initiator = opts.initiator || null;
    const printChannel = opts.printChannel || null;
    const muid = opts.muid || null;

    const searchResult = await findIdByNameOrId(nameOrId);
    if (!searchResult) {
      return `Couldn't find user ${nameOrId}`;
    }
    const { name, id } = searchResult;
    const userPing = `@[${escapeMd(name)}](${id})`;

    ban(null, id, null, true, false, 'mute', timeMin && timeMin * 60, muid);
    if (printChannel) {
      if (timeMin) {
        this.broadcastChatMessage(
          'info',
          (initiator)
            ? `${userPing} has been muted for ${timeMin}min by ${initiator}`
            : `${userPing} has been muted for ${timeMin}min`,
          printChannel,
          this.infoUserId,
        );
      } else {
        this.broadcastChatMessage(
          'info',
          (initiator)
            ? `${userPing} has been muted forever by ${initiator}`
            : `${userPing} has been muted forever`,
          printChannel,
          this.infoUserId,
        );
      }
    }
    logger.info(`${initiator} muted user ${userPing}`);
    return null;
  }

  async unmute(nameOrId, opts) {
    const initiator = opts.initiator || null;
    const printChannel = opts.printChannel || null;
    const muid = opts.muid || null;

    const searchResult = await findIdByNameOrId(nameOrId);
    if (!searchResult) {
      return `Couldn't find user ${nameOrId}`;
    }
    const { name, id } = searchResult;
    const userPing = `@[${escapeMd(name)}](${id})`;

    const succ = await unban(null, id, null, null, true, false, muid);
    if (!succ) {
      return `User ${userPing} is not muted`;
    }
    if (printChannel) {
      this.broadcastChatMessage(
        'info',
        (initiator)
          ? `${userPing} has been unmuted by ${initiator}`
          : `${userPing} has been unmuted`,
        printChannel,
        this.infoUserId,
      );
    }
    logger.info(`Unmuted user ${userPing}`);
    return null;
  }
}

export default new ChatProvider();
