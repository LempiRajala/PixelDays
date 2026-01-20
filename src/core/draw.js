/*
 * draw pixel on canvas by user
 */

import {
  getPixelFromChunkOffset, isIntervalActive,
} from './utils.js';
import logger, { pixelLogger } from './logger.js';
import allowPlace from '../data/redis/cooldown.js';
import { USERLVL } from '../data/sql/index.js';
import socketEvents from '../socket/socketEvents.js';
import { getCooldownFactor } from './CooldownModifiers.js';
import { setPixelByOffset } from './setPixel.js';
import { getState } from './SharedState.js';
import canvases from './canvases.js';

import {
  THREE_CANVAS_HEIGHT, THREE_TILE_SIZE, TILE_SIZE,
} from './constants.ts';

let coolDownFactor = 1;
socketEvents.on('setCoolDownFactor', (newFac) => {
  coolDownFactor = newFac;
});

/*
 * IPs who are currently requesting pixels
 * (have to log in order to avoid race conditions)
 */
const curReqIPs = new Map();
setInterval(() => {
  // clean up old data
  const ts = Date.now() - 20 * 1000;
  const ips = [...curReqIPs.keys()];
  for (let i = 0; i < ips.length; i += 1) {
    const ip = ips[i];
    const limiter = curReqIPs.get(ip);
    if (limiter && ts > limiter) {
      curReqIPs.delete(ip);
      logger.warn(
        `Pixel requests from ${ip} got stuck`,
      );
    }
  }
}, 20 * 1000);


/**
 *
 * By Offset is preferred on server side
 * This gets used by websocket pixel placing requests
 * @param user user object or null
 * @param ip ip object
 * @param canvasId
 * @param i Chunk coordinates
 * @param j
 * @param pixels Array of individual pixels within the chunk, with:
 *        [[offset, color], [offset2, color2],...]
 *        Offset is the offset of the pixel within the chunk
 * @param connectedTs Timestamp when connection got established.
 *        if the connection is younger than the cooldown of the canvas,
 *        we fill up the cd on first pixel to nerf one-connection
 *        ip-changing cheaters
 * @return Promise<Object>
 */
export default async function drawByOffsets(
  user,
  ip,
  canvasId,
  i,
  j,
  pixels,
  connectedTs,
) {
  let wait = 0;
  let coolDown = 0;
  let retCode = 0;
  let pxlCnt = 0;
  let rankedPxlCnt = 0;
  const { ipString } = ip;

  try {
    const startTime = Date.now();

    if (curReqIPs.has(ipString)) {
      // already setting a pixel somewhere
      logger.warn(
        `Got simultaneous requests from ${ipString}`,
      );
      throw new Error(13);
    }
    curReqIPs.set(ipString, startTime);

    const canvas = canvases[canvasId];
    if (!canvas || canvas.ed) {
      // canvas doesn't exist or is expired
      throw new Error(1);
    }

    const canvasSize = canvas.size;
    const is3d = !!canvas.v;

    const tileSize = (is3d) ? THREE_TILE_SIZE : TILE_SIZE;
    /*
     * canvas/chunk validation
     */
    if (i >= canvasSize / tileSize) {
      // x out of bounds
      // (we don't have to check for <0 because it is received as uint)
      throw new Error(2);
    }
    if (j >= canvasSize / tileSize) {
      // y out of bounds
      // (we don't have to check for <0 because it is received as uint)
      throw new Error(3);
    }

    const isAdmin = (user?.userlvl >= USERLVL.ADMIN);
    const req = (isAdmin) ? null : canvas.req;
    const clrIgnore = canvas.cli || 0;
    let factor = (isAdmin
      || (user?.userlvl >= USERLVL.CLEANER && pixels[0][1] < clrIgnore))
      ? 0.0 : coolDownFactor;

    factor *= getCooldownFactor(ip.country, ipString);

    const bcd = Math.floor(canvas.bcd * factor);
    const pcd = Math.floor((canvas.pcd) ? canvas.pcd * factor : bcd);
    const userId = user?.id || 0;
    const pxlOffsets = [];

    /*
     * validate pixels
     */
    let ranked = canvas.ranked && pcd;
    for (let u = 0; u < pixels.length; u += 1) {
      const [offset, color] = pixels[u];
      pxlOffsets.push(offset);

      const [x, y, z] = getPixelFromChunkOffset(i, j, offset, canvasSize, is3d);
      pixelLogger.info(
        // eslint-disable-next-line max-len
        `${startTime} ${ipString} ${userId} ${canvasId} ${x} ${y} ${z} ${color}`,
      );

      const maxSize = (is3d) ? tileSize * tileSize * THREE_CANVAS_HEIGHT
        : tileSize * tileSize;
      if (offset >= maxSize) {
        // z out of bounds or weird stuff
        throw new Error(4);
      }

      if (color >= canvas.colors.length) {
        // color out of bounds
        throw new Error(5);
      }
      if (color < clrIgnore) {
        // admins, jannies, cleaners and mods can place unset pixels
        if ((!user || user.userlvl < USERLVL.CLEANER)
          && !(canvas.v && color === 0)
        ) {
          // color out of bounds
          throw new Error(5);
        }
      } else if (factor === 0.0 && !isAdmin) {
        /*
         * i.e.: mod sends ordianry pixels together with a started 0 cd pixel,
         * a rare or impossible occurance, unless malicious
         * NOTE: in case of future additions of 0cd possibilities, this needs
         * a refactors
         */
        throw new Error(5);
      }

      /* 3D Canvas Minecraft Avatars */
      // && x >= 96 && x <= 128 && z >= 35 && z <= 100
      // 96 - 128 on x
      // 32 - 128 on z
      if (canvas.v && i === 19 && j >= 17 && j < 20 && !isAdmin) {
        // protected pixel
        throw new Error(8);
      }

      /* dont rank antarctica */
      if (canvasId === 0 && y > 14450) {
        ranked = false;
      }
    }

    const { cds } = canvas;
    // start with almost filled cd on new connections
    let cdIfNull = cds - pcd + 1000 - startTime + connectedTs;
    if (cdIfNull < 0 || userId || bcd === 0) {
      cdIfNull = 0;
    }

    if (getState().needVerification && (
      !user || user.userlvl < USERLVL.VERIFIED
    )) {
      throw new Error(17);
    }

    // eslint-disable-next-line prefer-const
    let { isBanned, isProxy } = await ip.getAllowance();
    if (!isProxy && !isBanned && user) {
      ({ isBanned } = await user.getAllowance());
    }
    if (isBanned) {
      throw new Error(14);
    }

    /* temporary blocks */
    if (user?.blockedInterval && isIntervalActive(user.blockedInterval, 1)) {
      throw new Error(18);
    }
    if (ip.blockedInterval && isIntervalActive(ip.blockedInterval, 1)) {
      throw new Error(18);
    }

    [
      retCode,
      pxlCnt,
      wait,
      coolDown,
    ] = await allowPlace(
      ipString,
      userId,
      ip.country,
      ranked,
      canvasId,
      canvas.linkcd ?? canvasId,
      i, j,
      clrIgnore,
      req,
      bcd, pcd,
      cds,
      cdIfNull,
      /*
       * don't increase counter if we are detected as a proxy, but still check
       * redis for captcha, since it is not smart to tell the user that he is
       * detected before he solved his captcha
       */
      isProxy,
      pxlOffsets,
    );

    if (pxlCnt > 0 && isProxy) {
      throw new Error(11);
    }

    for (let u = 0; u < pxlCnt; u += 1) {
      const [offset, color] = pixels[u];
      setPixelByOffset(canvasId, color, i, j, offset);
    }

    if (ranked && userId) {
      rankedPxlCnt = pxlCnt;
    }

    const duration = Date.now() - startTime;
    if (duration > 5000) {
      logger.warn(
        // eslint-disable-next-line max-len
        `Long response time of ${duration}ms for placing ${pxlCnt} pixels for user ${user?.id || ipString}`,
      );
    }
  } catch (e) {
    retCode = parseInt(e.message, 10);
    if (Number.isNaN(retCode)) {
      throw e;
    }
  }

  if (retCode !== 13) {
    curReqIPs.delete(ipString);
  }

  return {
    wait,
    coolDown,
    pxlCnt,
    rankedPxlCnt,
    retCode,
  };
}
