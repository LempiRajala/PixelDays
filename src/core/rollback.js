/*
 * Rolls back an area of the canvas to a specific date
 *
 */

// Tile creation is allowed to be slow
/* eslint-disable no-await-in-loop */

import http from 'http';
import https from 'https';
import sharp from 'sharp';

import RedisCanvas from '../data/redis/RedisCanvas.js';
import logger from './logger.js';
import { getChunkOfPixel, getHistoricalCanvasSize } from './utils.js';
import Palette from './Palette.js';
import { TILE_SIZE } from './constants.ts';
import { BACKUP_URL } from './config.js';
import canvases from './canvases.js';

function fetchHistoricalPngChunk(date, time, canvasId, cx, cy, url) {
  // to fatch full chunks from start of day, use only 'tiles' as time
  if (time === '0000') return null;
  // eslint-disable-next-line max-len
  const reqUrl = url || `${BACKUP_URL}/${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}/${canvasId}/${time}/${cx}/${cy}.png`;
  const protocol = (reqUrl.startsWith('http:')) ? http : https;

  return new Promise((resolve, reject) => {
    protocol.get(reqUrl, (res) => {
      switch (res.statusCode) {
        case 200: {
          const data = [];
          res.on('data', (chunk) => {
            data.push(Buffer.from(chunk));
          });

          res.on('end', () => {
            try {
              resolve(Buffer.concat(data));
            } catch (err) {
              reject(new Error(
                // eslint-disable-next-line max-len
                `Error on parsing chunk ${date}:${time}, ${cx}/${cy} from backups: ${err.message}`,
              ));
            }
          });
          break;
        }
        case 404:
          resolve(null);
          break;
        case 301: {
          // only allow one redirection
          if (res.headers.location && !url) {
            resolve(fetchHistoricalPngChunk(
              date, time, canvasId, cx, cy, res.headers.location,
            ));
            break;
          }
        }
        // eslint-disable-next-line no-fallthrough
        default: {
          reject(new Error(
            // eslint-disable-next-line max-len
            `Couldn't fetch chunk ${date}:${time}, ${cx}/${cy} from backups: HTTP Error ${res.statusCode}`,
          ));
        }
      }
    }).on('error', (err) => {
      reject(new Error(
        // eslint-disable-next-line max-len
        `Error on fetching chunk ${date}:${time}, ${cx}/${cy} from backups: ${err.message}`,
      ));
    });
  });
}

export default async function rollbackCanvasArea(
  canvasId, // number
  x, // number
  y, // number
  width, // number
  height, // number
  date, // string YYYYMMDD
  time, // string hhmm
) {
  if (!BACKUP_URL) {
    return 0;
  }

  logger.info(
    // eslint-disable-next-line max-len
    `Rollback area ${width}/${height} to ${x}/${y}/${canvasId} to ${date} ${time}`,
  );
  const canvas = canvases[canvasId];
  const { colors, size } = canvas;
  const histSize = getHistoricalCanvasSize(
    date, size, canvas.historicalSizes,
  );
  const palette = new Palette(colors);
  const canvasMinXY = -(size / 2);
  const histChunkOffset = (histSize - size) / TILE_SIZE / 2;

  const [ucx, ucy] = getChunkOfPixel(size, x, y);
  const [lcx, lcy] = getChunkOfPixel(size, x + width, y + height);

  let totalPxlCnt = 0;
  logger.info(`Loading to chunks from ${ucx} / ${ucy} to ${lcx} / ${lcy} ...`);
  let empty = false;
  let backupChunk;
  for (let cx = ucx; cx <= lcx; cx += 1) {
    for (let cy = ucy; cy <= lcy; cy += 1) {
      const histCx = cx + histChunkOffset;
      const histCy = cy + histChunkOffset;

      let [chunk, historicalChunk, historicalIncChunk] = await Promise.all([
        RedisCanvas.getChunk(canvasId, cx, cy, TILE_SIZE ** 2).catch(() => {
          logger.error(
            // eslint-disable-next-line max-len
            `Chunk ch:${canvasId}:${cx}:${cy} could not be loaded from redis, assuming empty.`,
          );
          return null;
        }),
        fetchHistoricalPngChunk(date, 'tiles', canvasId, histCx, histCy),
        fetchHistoricalPngChunk(date, time, canvasId, histCx, histCy),
      ]);

      if (!chunk || !chunk.length) {
        chunk = new Uint8Array(TILE_SIZE * TILE_SIZE);
        empty = true;
      } else {
        chunk = new Uint8Array(chunk);
        empty = false;
      }

      try {
        if (!historicalChunk && !historicalIncChunk) {
          logger.info(
            // eslint-disable-next-line max-len
            `Backup chunk ${date}:${time}, ${histCx}/${histCy} could not be loaded, assuming empty.`,
          );
          backupChunk = null;
        } else {
          if (!historicalChunk) {
            historicalChunk = historicalIncChunk;
            historicalIncChunk = null;
          }
          backupChunk = await sharp(historicalChunk);
          if (historicalIncChunk) {
            backupChunk = await backupChunk.composite([
              { input: historicalIncChunk, tile: true, blend: 'over' },
            ]);
          }
          backupChunk = await backupChunk.ensureAlpha().raw().toBuffer();
          backupChunk = new Uint32Array(backupChunk.buffer);
        }
      } catch (err) {
        throw new Error(
          // eslint-disable-next-line max-len
          `Error on compositing chunk ${date}:${time}, ${cx}/${cy} from backups: ${err.message}`,
        );
      }

      let pxlCnt = 0;
      if (!empty || backupChunk) {
        // offset of chunk in image
        const cOffX = cx * TILE_SIZE + canvasMinXY - x;
        const cOffY = cy * TILE_SIZE + canvasMinXY - y;
        let cOff = 0;
        for (let py = 0; py < TILE_SIZE; py += 1) {
          for (let px = 0; px < TILE_SIZE; px += 1) {
            const clrX = cOffX + px;
            const clrY = cOffY + py;
            if (clrX >= 0 && clrY >= 0 && clrX < width && clrY < height) {
              const pixel = (backupChunk)
                ? palette.abgr.indexOf(backupChunk[cOff]) : 0;
              if (pixel !== -1) {
                chunk[cOff] = pixel;
                pxlCnt += 1;
              }
            }
            cOff += 1;
          }
        }
      }
      if (pxlCnt) {
        const ret = await RedisCanvas.setChunk(cx, cy, chunk, canvasId);
        if (ret) {
          logger.info(`Loaded ${pxlCnt} pixels into chunk ${cx}, ${cy}.`);
          totalPxlCnt += pxlCnt;
        }
      }
      chunk = null;
    }
  }
  logger.info('Rollback done.');
  return totalPxlCnt;
}
