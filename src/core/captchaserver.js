/*
 * Creation of Captchas in a Worker
 * This is equivalent to the creation of JS Challenges in challengeserver.js
 */

import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';

import logger from './logger.js';
import socketEvents from '../socket/socketEvents.js';
import { getCaptchaFonts, setCaptchaFonts } from '../data/redis/captcha.js';
import { DailyCron } from '../utils/cron.js';
import { IS_BUNDLE } from './config.js';

const MAX_WAIT = 30 * 1000;
const FONT_FOLDER = path.resolve('captchaFonts');

/*
 * worker thread
 */
// const worker =
//   IS_BUNDLE
//   ? new Worker(path.resolve('workers', 'captchaloader.js'))
//   : new Worker(path.resolve('src', 'workers', 'captchaloader.js'));
const worker = new Worker(path.resolve('src', 'workers', 'captchaloader.js'));

/*
 * set captcha fonts according to stored fonts in redis
 */
export async function loadCaptchaFontsFromRedis() {
  const fonts = await getCaptchaFonts();
  worker.postMessage(`setCaptchaFonts,${JSON.stringify(fonts)}`);
}

/*
 * update captcha fonts
 */
socketEvents.on('setCaptchaFonts', async (fontFilenames) => {
  worker.postMessage(`setCaptchaFonts,${JSON.stringify(fontFilenames)}`);
});

/*
 * roll new captcha fonts
 */
export async function rollCaptchaFonts() {
  const fontFilenames = fs.readdirSync(FONT_FOLDER)
    .filter((e) => e.endsWith('.ttf') || e.endsWith('.otf'));
  const choosenFonts = [];
  let i = Math.min(fontFilenames.length, 3);
  while (i >= 0) {
    i -= 1;
    choosenFonts.push(fontFilenames[
      Math.floor(Math.random() * fontFilenames.length)
    ]);
  }
  await setCaptchaFonts(choosenFonts);
  logger.info(`CAPTCHAS: Rolled new fonts: ${choosenFonts.join(',')}`);
  socketEvents.broadcastCaptchaFonts(choosenFonts);
  return choosenFonts;
}

/*
 * roll daily by chance
 */
DailyCron.hook(() => {
  if (socketEvents.important && Math.random() > 0.5) {
    rollCaptchaFonts();
  }
});

/*
 * queue of captcha-generation tasks
 * [[ timestamp, callbackFunction ],...]
 */
const captchaQueue = [];

/*
 * generate a captcha in the worker thread
 * calls callback with arguments:
 *  (error, captcha.text, captcha.svgdata, captcha.id)
 */
export function requestCaptcha(cb) {
  worker.postMessage('createCaptcha');
  captchaQueue.push([Date.now(), cb]);
}

/*
 * answer of worker thread
 */
worker.on('message', (msg) => {
  while (captchaQueue.length) {
    const task = captchaQueue.shift();
    try {
      task[1](...msg);
      return;
    } catch {
      // continue
    }
  }
});

/*
 * clear requests if queue can't keep up
 */
function clearOldQueue() {
  const now = Date.now();
  if (captchaQueue.length
    && now - captchaQueue[0][0] > MAX_WAIT
  ) {
    logger.warn('CAPTCHAS Queue can not keep up!');
    captchaQueue.forEach((task) => {
      try {
        task[1]('TIMEOUT');
      } catch {
        // nothing
      }
    });
    captchaQueue.length = 0;
  }
}

setInterval(clearOldQueue, MAX_WAIT);
