/*
 * This is a constantly ongoing event where a random player gets selected and
 * has the chance to catcha a fish, which will reduce his cooldown
 */

/* eslint-disable import/prefer-default-export */

import logger from './logger.js';
import socketEvents from '../socket/socketEvents.js';
import { getAmountOfIPCooldownModifications } from './CooldownModifiers.js';
import chatProvider from './ChatProvider.js';
import { escapeMd, calculateFishBonusDuration } from './utils.js';
import { storeFish } from '../data/sql/Fish.js';
import {
  EVENT_USER_NAME,
  FISH_TYPES,
  FISH_BONUS_CD_FACTOR,
} from './constants.ts';
import { FISH_AMOUNT } from './config.js';

let totalWeight = 0;

function chooseFish() {
  let targetWeight = Math.floor(Math.random() * totalWeight);
  let i = FISH_TYPES.length;
  while (i > 0) {
    i -= 1;
    targetWeight -= FISH_TYPES[i].common;
    if (targetWeight <= 0) {
      const { minSize, maxSize } = FISH_TYPES[i];
      let size = minSize + Math.random() * (maxSize - minSize);
      // round at two digits
      size = Math.floor(size * 100) / 100;
      return [i, size];
    }
  }
  return [0, 1];
}

function runEventLoop() {
  if (!socketEvents.important) {
    setTimeout(runEventLoop, 600000);
    return;
  }

  const amountOfFishes = FISH_AMOUNT - getAmountOfIPCooldownModifications();
  if (amountOfFishes <= 0) {
    setTimeout(runEventLoop, 180000);
    logger.info('FISHING: no fishes to give out');
    return;
  }

  try {
    const { onlineIPs } = socketEvents;
    logger.info(
      // eslint-disable-next-line max-len
      `FISHING: Looking for ${amountOfFishes} fishers in ${onlineIPs.length} users`,
    );
    let fishers;
    if (onlineIPs.length <= amountOfFishes) {
      fishers = onlineIPs;
    } else {
      fishers = [];
      let loopCount = 0;
      while (fishers.length < amountOfFishes) {
        const randomIP = onlineIPs[
          Math.floor(Math.random() * onlineIPs.length)
        ];
        if (!fishers.includes(randomIP)) {
          fishers.push(randomIP);
        } else {
          if (loopCount > 10) {
            break;
          }
          loopCount += 1;
        }
      }
    }
    logger.info(`FISHING: Selected fishers: ${fishers.join(',')}`);

    for (const ip of fishers) {
      const [type, size] = chooseFish();
      logger.info(
        // eslint-disable-next-line max-len
        `FISHING: Selected for IP ${ip}, type: ${FISH_TYPES[type].name}, size: ${size}kg`,
      );
      socketEvents.sendFish(ip, type, size);
    }
  } catch (error) {
    logger.error(`FISHING: Error: ${error.message}`);
  }

  setTimeout(runEventLoop, 300000);
}

function registerCatchedFish(user, ip, type, size) {
  const duration = calculateFishBonusDuration(size);
  logger.info(
    // eslint-disable-next-line max-len
    `FISHING: ${user.id} ${ip} caught a fish with ${size} kg, earning ${duration}ms of lower cd`,
  );
  if (!user.isPrivate) {
    const userString = (user.id)
      ? `@[${escapeMd(user.name)}](${user.id})` : 'A player';
    if (chatProvider.enChannelId && chatProvider.eventUserId) {
      chatProvider.broadcastChatMessage(
        EVENT_USER_NAME,
        // eslint-disable-next-line max-len
        `${userString} caught a phish! It's a ${FISH_TYPES[type].name} with ${size}kg`,
        chatProvider.enChannelId,
        chatProvider.eventUserId,
      );
    }
  }

  if (user.id) {
    storeFish(user.id, type, size);
  }

  socketEvents.broadcastIPCooldownModifier(
    ip, FISH_BONUS_CD_FACTOR, Date.now() + duration,
  );
}

export function giveEveryoneAFish() {
  const { onlineIPs: fishers } = socketEvents;
  logger.info('FISHING: Give everyone a fish');

  for (const ip of fishers) {
    const [type, size] = chooseFish();
    logger.info(
      // eslint-disable-next-line max-len
      `FISHING: Selected for IP ${ip}, type: ${FISH_TYPES[type].name}, size: ${size}kg`,
    );
    socketEvents.sendFish(ip, type, size);
  }
}

export function initialize() {
  totalWeight = 0;
  FISH_TYPES.forEach((fish) => {
    totalWeight += fish.common;
  });
  runEventLoop();
  logger.info('FISHING: fishing enabled');
}

socketEvents.on('registerCatchedFish', registerCatchedFish);
