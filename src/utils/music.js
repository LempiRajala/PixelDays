/*
 * play notes visible on canvas
 *
 * This never went anywhere, because all methods of detecting a notesheet were
 * too expensive. And doing them only on buttom press would be annoying:
 */

/* eslint-disable */

import { TILE_SIZE, CANVAS_TYPES } from '../core/constants.ts';
import { getTileOfPixel, getCornerOfChunk } from '../core/utils.js';

/* WAS A GOOD IDEA, BUT NOT USIN THIS CLASS */
class ChunkScanner {
  // function that returns a uint8array of chunk
  getChunk;
  // callback function that is execute per pixel
  callback;
  // size of canvas
  canvasSize;
  // info about chunks of total affected area
  // cx, cy: top right chunk coords
  // cw, ch: height and width in chunks
  // amountChunks: cw * ch
  cx = 0;
  cy = 0;
  cw = 0;
  ch = 0;
  // iterator
  cIter = 0;
  // boolean to turn of
  running = false;
  // 3x3 canvas area
  // [
  //   [AA, AB, AC],
  //   [BA, BB, BC],
  //   [CA, CB, CC],
  // ]
  chunks;
  // chunk coordinates of center BB of chunks
  centerChunk;

  /*
   * @param getChunk(i, j) function that returns Uint8Array of chunk
   */
  constructor(getChunk, canvasSize) {
    this.getChunk = getChunk;
    this.canvasSize = canvasSize;
    this.scanChunk = this.scanChunk.bind(this);
  }

  get amountChunks() {
    return this.cw * this.ch;
  }

  scanChunkArea(cx, cy, cw, ch, callback) {
    this.cx = cx;
    this.cy = cy;
    this.cw = cw;
    this.ch = ch;
    this.callback = callback;
    this.cIter = 0;
    this.running = true;
    this.scan(callback);
  }

  async scanChunk() {
    const {
      cIter, cx, cy, cw, ch,
    } = this;
    if (cIter >= this.amountChunks || !this.running) {
      return;
    }
    let i = (cIter % cw);
    const j = ((cIter - i) / cw) + cy;
    i += cx;

    await this.loadChunkArea(i, j);

    if (this.checkIfChunkInArea(i, j)) {
      const [xCor, yCor] = getCornerOfChunk(this.canvasSize, i, j);
      const xLow = (xCor > this.x) ? 0 : (this.x - xCor);
      const yLow = (yCor > this.y) ? 0 : (this.y - yCor);
      const xHigh = (xCor + TILE_SIZE <= this.u) ? TILE_SIZE
        : (this.u - xCor + 1);
      const yHigh = (yCor + TILE_SIZE <= this.v) ? TILE_SIZE
        : (this.v - yCor + 1);
      for (let xc = xLow; xc < xHigh; xc += 1) {
        for (let yc = yLow; yc < yHigh; yc += 1) {
          // eslint-disable-next-line no-await-in-loop
          await this.callback(xc, yc, this);
        }
      }
    }

    this.cIter += 1;
    setTimeout(this.scanChunk, 0);
  }

  async loadChunkArea(i, j) {
    const { chunks, centerChunk, getChunk } = this;
    const [io, jo] = centerChunk;
    const newChunks = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    for (let iRel = -1; iRel <= 1; iRel += 1) {
      for (let jRel = -1; jRel <= 1; jRel += 1) {
        let chunk = null;
        const iAbs = iRel + i;
        const jAbs = jRel + j;
        if (
          io !== null && jo !== null
          && iAbs >= io - 1
          && iAbs <= io + 1
          && jAbs >= jo - 1
          && jAbs <= jo + 1
        ) {
          chunk = chunks[jAbs - jo + 1][iAbs - io + 1];
        } else {
          try {
            // eslint-disable-next-line no-await-in-loop
            chunk = await getChunk(iAbs, jAbs);
          } catch (error) {
            this.logger(
              `Couldn't load chunk ch:${iAbs}:${jAbs}: ${error.message}}`,
            );
          }
        }
        newChunks[jRel + 1][iRel + 1] = chunk;
      }
    }
    this.chunks = newChunks;
    this.centerChunk = [i, j];
  }

  /*
   * check if chunk exists in area and is not empty
   * @param i, j chunk to check
   */
  checkIfChunkInArea(i, j) {
    const { chunks, centerChunk } = this;
    const [io, jo] = centerChunk;
    if (
      io !== null && jo !== null
      && i >= io - 1
      && i <= io + 1
      && j >= jo - 1
      && j <= jo + 1
    ) {
      const col = i - io + 1;
      const row = j - jo + 1;
      if (chunks[row][col] !== null) {
        return true;
      }
    }
    return false;
  }
}

async function getChunkArea(chunkLoader2D, cx, cy, cw, ch) {
  const areaWidth = cw * TILE_SIZE;
  const area = new Uint8Array(areaWidth * ch * TILE_SIZE);
  for (let i = cx; i < cx + cw; i += 1) {
    for (let j = cy; j < cy + ch; j += 1) {
      const chunkKey = `${chunkLoader2D.canvasMaxTiledZoom}:${i}:${j}`;
      const chunk = chunkLoader2D.cget(chunkKey);
      if (!chunk.ready) {
        continue;
      }
      const chunkOffsetX = (i - cx) * TILE_SIZE;
      const chunkOffsetY = (j - cy) * TILE_SIZE;
      for (let u = 0; u < TILE_SIZE; u += 1) {
        for (let v = 0; v < TILE_SIZE; v += 1) {
          const ind = chunk.getColorIndex([u, v], false);
          area[(chunkOffsetY + v) * areaWidth + chunkOffsetX + u] = ind;
        }
      }
    }
  }
  return area;
}

/*
 * Finds and parses music on visible chunks
 * @return the closest to center found music or null if none found
 */
export async function parseNotes(renderer) {
  if (renderer.type === CANVAS_TYPES.TWOD || !renderer.store) {
    return null;
  }
  const [x, y, scale] = renderer.view;
  if (scale < 1) {
    return null;
  }
  const chunkLoader = renderer.chunks;
  const {
    width: viewportWidth,
    height: viewportHeight,
  } = renderer.getViewport();
  const CHUNK_RENDER_RADIUS_X = Math.ceil(
    viewportWidth / TILE_SIZE / 2 / scale,
  );
  const CHUNK_RENDER_RADIUS_Y = Math.ceil(
    viewportHeight / TILE_SIZE / 2 / scale,
  );
  const { canvasSize } = renderer.store.getState().canvas;
  const [xc, yc] = getTileOfPixel(1, [x, y], canvasSize);

  let chunk;
  for (
    let dx = -CHUNK_RENDER_RADIUS_X;
    dx <= CHUNK_RENDER_RADIUS_X;
    dx += 1
  ) {
    for (
      let dy = -CHUNK_RENDER_RADIUS_Y;
      dy <= CHUNK_RENDER_RADIUS_Y;
      dy += 1
    ) {
      const cx = xc + dx;
      const cy = yc + dy;
      if (cx < 0 || cx > canvasSize / TILE_SIZE
        || cy < 0 || cy > canvasSize / TILE_SIZE
      ) {
        continue;
      }

      chunk = chunkLoader.getChunk(chunkLoader.canvasMaxTiledZoom, cx, cy, false);
    }
  }
}
