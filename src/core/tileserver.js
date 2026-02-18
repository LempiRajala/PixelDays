/*
 * creation of zoom tiles
 *
 */

import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';

import logger from './logger.js';
import canvases from './canvases.js';
import socketEvents from '../socket/socketEvents.js';

import { TILE_FOLDER } from './config.js';
import {
  TILE_SIZE,
  TILE_ZOOM_LEVEL,
} from './constants.ts';
import { mod, getMaxTiledZoom } from './utils.js';
import { cwd } from 'process';


const CanvasUpdaters = {};

/*
 * worker thread
 */
const worker = new Worker(path.resolve(cwd(), 'src/workers/tilewriter.js'));

/*
 * queue of tasks that is worked on in FIFO
 */
const taskQueue = [];

function enqueueTask(task) {
  if (!taskQueue.length) {
    worker.postMessage(task);
  }
  taskQueue.push(task);
}

worker.on('message', () => {
  taskQueue.shift();
  if (taskQueue.length) {
    worker.postMessage(taskQueue[0]);
  }
});

/*
 * every canvas gets an instance of this class
 */
class CanvasUpdater {
  TileLoadingQueues;
  id;
  canvas;
  firstZoomtileWidth;
  canvasTileFolder;

  constructor(id) {
    this.updateZoomlevelTiles = this.updateZoomlevelTiles.bind(this);

    this.TileLoadingQueues = [];
    this.id = id;
    this.canvas = canvases[id];
    this.canvasTileFolder = path.resolve(TILE_FOLDER, String(id));
    this.firstZoomtileWidth = this.canvas.size / TILE_SIZE / TILE_ZOOM_LEVEL;
    this.maxTiledZoom = getMaxTiledZoom(this.canvas.size);
  }

  /*
   * @param zoom tilezoomlevel to update
   */
  async updateZoomlevelTiles(zoom) {
    const queue = this.TileLoadingQueues[zoom];
    if (typeof queue === 'undefined') {
      console.log('[updateZoomlevelTiles] queue is undefined');
      return;
    }

    const tile = queue.shift();
    if (typeof tile === 'undefined') {
      // console.log('[updateZoomlevelTiles] queue is empty');
      return;
    }

    const width = TILE_ZOOM_LEVEL ** zoom;
    const cx = mod(tile, width);
    const cy = Math.floor(tile / width);

    if (zoom === this.maxTiledZoom - 1) {
      enqueueTask({
        task: 'createZoomTileFromChunk',
        args: [
          this.id,
          this.canvas,
          this.canvasTileFolder,
          [cx, cy],
        ],
      });
    } else if (zoom !== this.maxTiledZoom) {
      enqueueTask({
        task: 'createZoomedTile',
        args: [
          this.canvas,
          this.canvasTileFolder,
          [zoom, cx, cy],
        ],
      });
    }

    if (zoom === 0) {
      enqueueTask({
        task: 'createTexture',
        args: [
          this.id,
          this.canvas,
          this.canvasTileFolder,
        ],
      });
    } else {
      const [ucx, ucy] = [cx, cy].map((z) => Math.floor(z / TILE_ZOOM_LEVEL));
      const upperTile = ucx + ucy * (TILE_ZOOM_LEVEL ** (zoom - 1));
      const upperQueue = this.TileLoadingQueues[zoom - 1];
      if (upperQueue.indexOf(upperTile) !== -1) {
        console.log(`[updateZoomlevelTiles] upperTile (${upperTile}) found in upperQueue`);
        return;
      }

      upperQueue.push(upperTile);
      logger.info(`Tiling: Enqueued ${zoom - 1}, ${ucx}, ${ucy} for reload`);
    }
  }

  /*
   * register changed chunk, queue corresponding tile to reload
   * @param chunk Chunk coordinates
   */
  registerChunkChange(chunk) {
    const queue = this.TileLoadingQueues[Math.max(this.maxTiledZoom - 1, 0)];
    if (typeof queue === 'undefined') return;

    const [cx, cy] = chunk.map((z) => Math.floor(z / TILE_ZOOM_LEVEL));
    const chunkOffset = cx + cy * this.firstZoomtileWidth;
    if (~queue.indexOf(chunkOffset)) return;
    queue.push(chunkOffset);
    /*
    logger.info(
      `Tiling: Enqueued ${cx}, ${cy} / ${this.id} for basezoom reload`,
    );
    */
  }

  async generateAllPreviews(batchSize = 10, delayBetweenBatches = 1000) {
    logger.info(`Tiling: Starting preview generation for canvas ${this.id}`);
    const targetSize = Math.min(this.canvas.size, 4096);
    const textureZoom = getMaxTiledZoom(targetSize);

    if (this.maxTiledZoom === 0) {
      enqueueTask({
        task: 'createTexture',
        args: [
          this.id,
          this.canvas,
          this.canvasTileFolder,
        ],
      });
      return;
    }

    for (let zoom = this.maxTiledZoom - 1; zoom >= 0; zoom -= 1) {
      const maxTiles = TILE_ZOOM_LEVEL ** zoom;
      const tiles = [];
      
      for (let cx = 0; cx < maxTiles; cx += 1) {
        for (let cy = 0; cy < maxTiles; cy += 1) {
          tiles.push([cx, cy]);
        }
      }

      for (let i = 0; i < tiles.length; i += batchSize) {
        const batch = tiles.slice(i, i + batchSize);
        
        for (const [cx, cy] of batch) {
          if (zoom === this.maxTiledZoom - 1) {
            enqueueTask({
              task: 'createZoomTileFromChunk',
              args: [
                this.id,
                this.canvas,
                this.canvasTileFolder,
                [cx, cy],
              ],
            });
          } else {
            enqueueTask({
              task: 'createZoomedTile',
              args: [
                this.canvas,
                this.canvasTileFolder,
                [zoom, cx, cy],
              ],
            });
          }
        }

        if (i + batchSize < tiles.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }

      logger.info(`Tiling: Generated for zoom ${zoom}`);
    }

    if (textureZoom >= this.maxTiledZoom) {
      const zoom = this.maxTiledZoom;
      const maxTiles = TILE_ZOOM_LEVEL ** zoom;
      const tiles = [];
      for (let cx = 0; cx < maxTiles; cx += 1) {
        for (let cy = 0; cy < maxTiles; cy += 1) {
          tiles.push([cx, cy]);
        }
      }
      for (let i = 0; i < tiles.length; i += batchSize) {
        const batch = tiles.slice(i, i + batchSize);
        for (const [cx, cy] of batch) {
          enqueueTask({
            task: 'createZoomedTile',
            args: [
              this.canvas,
              this.canvasTileFolder,
              [zoom, cx, cy],
            ],
          });
        }
        if (i + batchSize < tiles.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }
      logger.info(`Tiling: Generated texture zoom level ${zoom}`);
    }

    enqueueTask({
      task: 'createTexture',
      args: [
        this.id,
        this.canvas,
        this.canvasTileFolder,
      ],
    });

    logger.info(`Tiling: Finished preview generation for canvas ${this.id}`);
  }

  /*
   * initialize queues and start loops for updating tiles
   */
  async initialize() {
    logger.info(`Tiling: Using folder ${this.canvasTileFolder}`);
    if (!fs.existsSync(path.resolve(this.canvasTileFolder, '0'))) {
      if (!fs.existsSync(this.canvasTileFolder)) {
        fs.mkdirSync(this.canvasTileFolder);
      }
      logger.warn(
        'Tiling: tiledir empty, will initialize it, this can take some time',
      );
      enqueueTask({
        task: 'initializeTiles',
        args: [
          this.id,
          this.canvas,
          this.canvasTileFolder,
          false,
        ],
      });
    }
    for (let c = 0; c < this.maxTiledZoom; c += 1) {
      this.TileLoadingQueues.push([]);
      const invZoom = this.maxTiledZoom - c;
      // eslint-disable-next-line max-len
      const timeout = TILE_ZOOM_LEVEL ** (2 * invZoom) * (6 / TILE_ZOOM_LEVEL ** 2) * 1000;
      logger.info(
        `Tiling: Set interval for zoomlevel ${c} update to ${timeout / 1000}`,
      );

      setTimeout(() => {
        setInterval(this.updateZoomlevelTiles, timeout, c);
      }, Math.floor(Math.random() * timeout));
    }
    if (this.maxTiledZoom === 0) {
      // in the case of canvasSize == 256
      this.TileLoadingQueues.push([]);
      const timeout = 5 * 60 * 1000;

      setInterval(this.updateZoomlevelTiles, timeout, 0);
    }
  }
}

socketEvents.on('chunkUpdate', (canvasId, chunk) => {
  if (CanvasUpdaters[canvasId]) {
    CanvasUpdaters[canvasId].registerChunkChange(chunk);
  }
});

/*
 * starting update loops for canvases
 */
export default async function startAllCanvasLoops() {
  if (!fs.existsSync(TILE_FOLDER)) fs.mkdirSync(TILE_FOLDER);
  const ids = Object.keys(canvases);
  for (let i = 0; i < ids.length; i += 1) {
    const id = parseInt(ids[i], 10);
    const canvas = canvases[id];
    if (!canvas.v) {
      // just 2D canvases
      const updater = new CanvasUpdater(id);
      await updater.initialize();
      CanvasUpdaters[id] = updater;
    }
  }
}

export { CanvasUpdaters }