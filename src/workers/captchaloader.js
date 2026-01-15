/*
 * worker thread for creating Captchas
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';
import ppfunCaptcha from 'ppfun-captcha';
import { isMainThread, parentPort } from 'worker_threads';

import { getRandomString } from '../core/utils.js';
import filter from '../funcs/captchaFilter.js';

const FONT_FOLDER = path.resolve(__dirname, '..', '..', 'dist', 'captchaFonts');

if (isMainThread) {
  throw new Error(
    'CaptchaLoader is run as a worker thread, not as own process',
  );
}

let font;

function setCaptchaFonts(fontFilenames) {
  let newFont = fontFilenames
    .map((f) => path.join(FONT_FOLDER, f))
    .filter((f) => fs.existsSync(f));
  /*
   * default to first three files, if none others defined
   */
  if (!newFont.length) {
    newFont = fs.readdirSync(FONT_FOLDER)
      .filter((e) => e.endsWith('.ttf') || e.endsWith('.otf'))
      .slice(0, 3)
      .map((f) => path.join(FONT_FOLDER, f));
  }
  font = newFont.map((f) => ppfunCaptcha.loadFont(f));
  // eslint-disable-next-line max-len
  console.info(`CAPTCHAS: change fonts to ${newFont.map((f) => f.slice(-15)).join(',')}`);
}

function createCaptcha() {
  return ppfunCaptcha.create({
    width: 500,
    height: 300,
    fontSize: 180,
    stroke: 'black',
    fill: 'none',
    nodeDeviation: 2.5,
    connectionPathDeviation: 10.0,
    style: 'stroke-width: 4;',
    background: '#EFEFEF',
    font,
    filter,
  });
}

parentPort.on('message', (msg) => {
  try {
    if (msg === 'createCaptcha') {
      if (!font?.length) {
        throw new Error('No Fonts Loaded');
      }
      const captcha = createCaptcha();
      const captchaid = getRandomString();
      parentPort.postMessage([
        null,
        captcha.text,
        captcha.data,
        captchaid,
      ]);
      return;
    }

    const comma = msg.indexOf(',');
    if (comma === -1) {
      throw new Error('No comma');
    }
    const key = msg.slice(0, comma);
    const val = JSON.parse(msg.slice(comma + 1));
    switch (key) {
      case 'setCaptchaFonts': {
        setCaptchaFonts(val);
        break;
      }
      default:
        // nothing
    }
  } catch (error) {
    console.warn(
      // eslint-disable-next-line max-len
      `CAPTCHAS: Error on ${msg}: ${error.message}`,
    );
    parentPort.postMessage(['Failure!']);
  }
});
