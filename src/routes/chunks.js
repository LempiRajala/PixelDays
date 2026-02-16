/**
 *
 * Outputs binary chunk directly from redis
 *
 */

import etag from 'etag';
import RedisCanvas from '../data/redis/RedisCanvas.js';
import logger from '../core/logger.js';
import socketEvents from '../socket/socketEvents.js';
import { CDN_HOST, NO_CDN_COUNTRIES } from '../core/config.js';

const chunkEtags = new Map();
socketEvents.on('chunkUpdate', (canvasId, [i, j]) => {
  chunkEtags.delete(`${canvasId}:${i}:${j}`);
});

/*
 * Send binary chunk to the client
 */
export default async (req, res, next) => {
  if (CDN_HOST
    && CDN_HOST !== req.ip.getHost(false, false)
    && !NO_CDN_COUNTRIES?.includes(req.ip.country)
  ) {
    /*
     * do not allow chunks and tiles requests from any other URL than CDN,
     * if CDN_URL is set
     */
    res.redirect(`${req.protocol}://${CDN_HOST}${req.originalUrl}`);
    return;
  }

  const {
    c: paramC,
    x: paramX,
    y: paramY,
  } = req.params;
  const c = parseInt(paramC, 10);
  const x = parseInt(paramX, 10);
  const y = parseInt(paramY, 10);
  if (Number.isNaN(paramC) || Number.isNaN(paramX) || Number.isNaN(paramY)) {
    next();
    return;
  }
  try {
    res.set({
      'Access-Control-allow-origin': '*',
    });
    // botters where using cachebreakers to update via chunk API
    // lets not allow that for now
    if (Object.keys(req.query).length !== 0) {
      res.status(400).end();
      return;
    }

    const etagKey = `${c}:${x}:${y}`;
    let curEtag = chunkEtags.get(etagKey);
    const preEtag = req.headers['if-none-match'];

    res.set({
      // 'Cache-Control': `public, s-maxage=${60}, max-age=${40}`, // seconds
      'Cache-Control': 'no-cache',
    });

    if (curEtag && preEtag && preEtag === curEtag) {
      res.set({
        ETag: curEtag,
      });
      res.status(304).end();
      return;
    }

    let chunk;
    try {
      const stime = Date.now();
      chunk = await RedisCanvas.getChunk(c, x, y);
      const dur = Date.now() - stime;
      if (dur > 6000) {
        // eslint-disable-next-line max-len
        logger.warn(`Long redis response times of ${dur}ms for chunk ${c}:${x},${y}`);
      }
    } catch (error) {
      logger.error(`Error on routes/chunks: ${error.message}`);
      res.status(503).end();
      return;
    }

    res.set({
      'Content-Type': 'application/octet-stream',
    });

    if (!chunk) {
      res.status(200).end();
      return;
    }

    curEtag = etag(chunk, { weak: true });
    res.set({
      ETag: curEtag,
    });
    chunkEtags.set(etagKey, curEtag);
    if (preEtag === curEtag) {
      res.status(304).end();
      return;
    }

    res.end(chunk, 'binary');
  } catch (error) {
    next(error);
  }
};
