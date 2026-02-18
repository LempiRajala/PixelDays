/**
 *
 * check for captcha requirement
 */

import logger from '../../core/logger.js';
import client from './client.js';
import { simpleHash } from '../../core/utils.js';
import {
  CAPTCHA_TIME,
  CAPTCHA_TIMEOUT,
  TRUSTED_TIME,
} from '../../core/config.js';

const TTL_CACHE = CAPTCHA_TIME * 60; // minutes to seconds
const TTL_TRUSTED = TRUSTED_TIME * 60 * 60; // hours to seconds
const CHALLENGE_TIMEOUT = CAPTCHA_TIMEOUT * 3;

export const PREFIX = 'human';
export const SOLUTION_PREFIX = 'capt';
export const TRUSTED_PREFIX = 'trus';
export const CHALLENGE_PREFIX = 'chal';
export const CHALLENGE_IP_MAP_PREFIX = 'chip';
export const CAPTCHA_FONT_KEY = 'cfont';

/*
 * chars that are so similar that we allow them to get mixed up
 * left: captcha text
 * right: user input
 */
const graceChars = [
  ['I', 'l'],
  ['l', 'I'],
  ['l', 'i'],
  ['i', 'j'],
  ['j', 'i'],
  ['0', 'O'],
  ['0', 'o'],
  ['O', '0'],
];

/*
 * Compare chars of captcha to result
 * @return true if chars are the same
 */
function evaluateChar(charC, charU) {
  if (charC.toLowerCase() === charU.toLowerCase()) {
    return true;
  }
  for (let i = 0; i < graceChars.length; i += 1) {
    const [cc, cu] = graceChars[i];
    if (charC === cc && charU === cu) {
      return true;
    }
  }
  return false;
}

/*
 * Compare captcha to result
 * @return true if same
 */
function evaluateResult(captchaText, userText) {
  if (captchaText.length !== userText.length) {
    return false;
  }
  for (let i = 0; i < captchaText.length; i += 1) {
    if (!evaluateChar(captchaText[i], userText[i])) {
      return false;
    }
  }
  return true;
}

/*
 * store captcha fonts
 * @param Array of font filenames
 */
export async function setCaptchaFonts(captchaFonts) {
  try {
    if (!captchaFonts.length) {
      return;
    }
    await client.set(CAPTCHA_FONT_KEY, JSON.stringify(captchaFonts));
  } catch (err) {
    logger.error(`Error storing captcha fonts: ${err.message}`);
  }
}

/*
 * get stored captcha fonts
 * @return Array of font filenames
 */
export async function getCaptchaFonts() {
  try {
    const fonts = await client.get(CAPTCHA_FONT_KEY);
    if (!fonts) return [];
    return JSON.parse(fonts);
  } catch (err) {
    logger.error(`Error getting captcha fonts: ${err.message}`);
    return [];
  }
}

/**
 * mark client as trusted after successfully solving challenge
 * @param ipString ip as string
 * @param ua User-Agent string
 */
export async function markTrusted(ipString, ua) {
  try {
    const key = `${TRUSTED_PREFIX}:${ipString}:${simpleHash(ua)}`;
    await client.set(key, '', {
      EX: TTL_TRUSTED,
    });
  } catch (err) {
    logger.error(`Error setting IP Trusted: ${err.message}`);
  }
}

/**
 * check if client is trusted
 * @param ipString ip as string
 * @param ua User-Agent string
 * @return boolean
 */
export async function isTrusted(ipString, ua) {
  const key = `${TRUSTED_PREFIX}:${ipString}:${simpleHash(ua)}`;
  const ttl = await client.ttl(key);
  return ttl > 0;
}

/**
 * set challenge solution for IP
 * @param text challenge solution
 * @param ipString ip as string
 * @param ua User-Agent string
 */
export async function setChallengeSolution(text, ipString, ua) {
  try {
    const key = `${CHALLENGE_PREFIX}:${text}`;
    await client.set(key, `${ipString},${simpleHash(ua)}`, {
      EX: CHALLENGE_TIMEOUT,
    });
  } catch (err) {
    logger.error(`Error setting JS Challenge: ${err.message}`);
  }
}

/*
 * force captchas on everyone
 */
export async function resetAllCaptchas() {
  let amount = 0;
  for await (const key of client.scanIterator({
    TYPE: 'string',
    MATCH: `${TRUSTED_PREFIX}:*`,
    COUNT: 100,
  })) {
    amount += 1;
    await client.unlink(key);
  }
  for await (const key of client.scanIterator({
    TYPE: 'string',
    MATCH: `${PREFIX}:*`,
    COUNT: 100,
  })) {
    amount += 1;
    await client.unlink(key);
  }
  return amount;
}

/**
 * check challenge solution for IP
 * @param text challenge solution
 * @param ipString ip as string
 * @param ua User-Agent string
 * @return boolean
 */
export async function checkChallengeSolution(text, ipString, ua) {
  const key = `${CHALLENGE_PREFIX}:${text}`;
  const storedClient = await client.getDel(key);
  if (!storedClient) {
    return false;
  }
  const [storedIp, storeadUaHash] = storedClient.split(',');
  if (storeadUaHash !== simpleHash(ua)) {
    logger.info(`CHALLENGE ${ipString} failed User-Agent didn't match: ${ua}`);
    return false;
  }
  if (storedIp !== ipString) {
    /*
    * sometimes browsers on dual stack send one request through IPv4 and
    * another through IPv6, so we allow one deviation
    */
    const ipMappingKey = `${CHALLENGE_IP_MAP_PREFIX}:${storedIp}`;
    let ipMapping = await client.get(ipMappingKey);
    if (!ipMapping) {
      logger.info(`CHALLENGE map different IP: ${storedIp} -> ${ipString}`);
      await client.set(ipMappingKey, ipString, {
        EX: 7 * 24 * 60 * 60,
      });
      ipMapping = ipString;
    }
    if (ipString !== ipMapping) {
      // TODO check how many people this kicks out and either relax it or add
      // a seperate REST api for solving js challenges
      // eslint-disable-next-line max-len
      logger.info(`CHALLENGE failing mapping: ${storedIp} -> ${ipString} != ${ipMapping}`);
      return false;
    }
  }
  logger.info(`CHALLENGE ${ipString} successfully solved challenge ${text}`);
  await markTrusted(ipString, ua);
  return true;
}

/*
 * check captcha solution
 *
 * @param text Solution of captcha
 * @param ip
 * @param ua User-Agent string
 * @param onetime If the captcha is just one time or should be remembered
 * @param captchaid Id of the captcha
 * @param challenge result of the JS challenge
 * @return 0 if solution right
 *         1 if timed out
 *         2 if wrong
 */
export async function checkCaptchaSolution(
  text, ipString, ua, onetime, captchaid, challengeSolution,
) {
  if (!text || text.length > 10) {
    return 3;
  }
  if (!captchaid) {
    return 4;
  }
  const [solution, trusted] = await Promise.all([
    client.getDel(`${SOLUTION_PREFIX}:${captchaid}`),
    (challengeSolution)
      ? checkChallengeSolution(challengeSolution, ipString, ua)
      : isTrusted(ipString, ua),
  ]);
  if (!trusted) {
    logger.info(`CHALLENGE ${ipString} failed trust (${challengeSolution})`);
    return 6;
  }
  if (solution) {
    if (evaluateResult(solution, text)) {
      if (Math.random() < 0.1) {
        return 2;
      }
      if (!onetime) {
        const solvkey = `${PREFIX}:${ipString}`;
        await client.set(solvkey, '', {
          EX: TTL_CACHE,
        });
      }
      logger.info(`CAPTCHA ${ipString} successfully solved captcha ${text}`);
      return 0;
    }
    logger.info(
      `CAPTCHA ${ipString} got captcha wrong (${text} instead of ${solution})`,
    );
    return 2;
  }
  logger.info(`CAPTCHA ${ipString}:${captchaid} timed out`);
  return 1;
}

/**
 * check if captcha is needed
 * @param ip
 * @return boolean true if needed
 */
export async function needCaptcha(ipString) {
  if (CAPTCHA_TIME < 0) {
    return false;
  }
  const key = `${PREFIX}:${ipString}`;
  const ttl = await client.ttl(key);
  if (ttl > 0) {
    return false;
  }
  logger.info(`CAPTCHA ${ipString} got captcha`);
  return true;
}

/**
 * force ip to get captcha
 * @param ip
 * @return true if we triggered captcha
 *         false if user would have gotten one anyway
 */
export async function forceCaptcha(ipString) {
  if (CAPTCHA_TIME < 0) {
    return null;
  }
  const key = `${PREFIX}:${ipString}`;
  const ret = await client.del(key);
  return (ret > 0);
}
