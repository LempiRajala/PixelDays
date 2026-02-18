/*
 * Captcha: выдача капчи переведена на Go-сервис (captcha-lab).
 * Роут /captcha.svg проксирует на CAPTCHA_SERVICE_URL.
 * Ниже — закомментированный код старой генерации капчи в воркере (SVG).
 */

import fs from 'fs';
import path from 'path';

import logger from './logger.js';
import { setCaptchaFonts } from '../data/redis/captcha.js';

const FONT_FOLDER = path.resolve('captchaFonts');

export async function rollCaptchaFonts() {
  try {
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
    return choosenFonts;
  } catch (err) {
    logger.warn(`rollCaptchaFonts: ${err.message}`);
    return [];
  }
}

// DailyCron.hook(...) // TODO: с Go-капчей смена шрифтов на ноде не используется, шрифты в captcha-lab

// const captchaQueue = [];
// export function requestCaptcha(cb) { ... }
// worker.on('message', ...)
// function clearOldQueue() { ... }
// setInterval(clearOldQueue, MAX_WAIT);
