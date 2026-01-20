/*
 * Renders 2D canvases
 *
 */

/* eslint-disable no-underscore-dangle */

import {
  TILE_ZOOM_LEVEL,
  TILE_SIZE,
  MAX_SCALE,
  OVERLAY_SP_TH,
  BACKGROUND_CLR_HEX,
  CANVAS_TYPES,
} from '../core/constants.ts';

import {
  getTileOfPixel,
  getPixelFromChunkOffset,
  getMaxTiledZoom,
  clamp,
} from '../core/utils.js';

import {
  renderGrid,
  renderPlaceholder,
  renderPotatoPlaceholder,
  renderOverlay,
  renderSmallPOverlay,
} from './render2Delements.js';
import PixelPainterControls from '../controls/PixelPainterControls.js';

import Renderer from './Renderer.js';
import ChunkLoader from './ChunkLoader2D.js';
import pixelNotify from './PixelNotify.js';

class Renderer2D extends Renderer {
  canvasId = null;
  viewscale = 0;
  //--
  centerChunk = [null, null];
  tiledScale = 0;
  tiledZoom = 4;
  hover = false;
  //--
  viewport = null;
  //--
  lastFetch = 0;
  canvas;
  //--
  oldHistoricalTime = null;

  constructor(store) {
    super(store);
    this.type = CANVAS_TYPES.TWOD;

    this.canvasMaxTiledZoom = 0;
    this.historicalCanvasMaxTiledZoom = 0;
    this.scaleThreshold = 1;
    //--
    const viewport = document.createElement('canvas');
    viewport.className = 'viewport';
    const viewportCtx = viewport.getContext('2d', { alpha: false });
    this.viewport = viewport;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    this.canvas = canvas;
    this.onWindowResize();
    //--
    context.fillStyle = '#C4C4C4';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    viewportCtx.fillStyle = '#C4C4C4';
    viewportCtx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    //--
    document.body.appendChild(this.viewport);
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);
    //--
    this.updateCanvasData(store.getState());
    this.controls = new PixelPainterControls(this, this.viewport, store);
  }

  destructor() {
    this.controls.dispose();
    window.removeEventListener('resize', this.onWindowResize);
    this.viewport.remove();
    super.destructor();
  }

  getViewport() {
    return this.viewport;
  }

  onWindowResize() {
    this.viewport.width = window.innerWidth;
    this.viewport.height = window.innerHeight;
    // dimensions of offscreen canvas NOT whole canvas
    const canvasWidth = 2 * Math.ceil(window.screen.width / 2)
      + TILE_ZOOM_LEVEL * TILE_SIZE;
    const canvasHeight = 2 * Math.ceil(window.screen.height / 2)
      + TILE_ZOOM_LEVEL * TILE_SIZE;
    if (this.canvas.width !== canvasWidth
      || this.canvas.height !== canvasHeight
    ) {
      // eslint-disable-next-line no-console
      console.log(`Noticed screen: ${canvasWidth} / ${canvasHeight}`);
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
      this.scaleThreshold = Math.min(
        canvasWidth / TILE_SIZE / 3,
        canvasHeight / TILE_SIZE / 3,
      );
    }
    this.forceNextRender = true;
  }

  updateCanvasData(state) {
    const {
      canvasId,
    } = state.canvas;
    if (canvasId !== this.canvasId) {
      this.canvasId = canvasId;
      if (canvasId !== null) {
        const {
          palette,
          canvasSize,
          canvases,
        } = state.canvas;
        this.canvasMaxTiledZoom = getMaxTiledZoom(canvasSize);
        this.historicalCanvasMaxTiledZoom = this.canvasMaxTiledZoom;
        this.chunkLoader = new ChunkLoader(
          this.store,
          canvasId,
          palette,
          canvasSize,
          canvases[canvasId].historicalSizes,
        );
      }
      this._view[2] = 0;
      this.updateView(state.canvas.view);
      this.forceNextRender = true;
    }
  }

  updateOldHistoricalTime(oldDate, oldTime) {
    if (oldTime === '0000') {
      this.oldHistoricalTime = null;
    } else {
      this.oldHistoricalTime = oldTime;
    }
  }

  updateHistoricalTime(historicalDate, historicalTime, historicalCanvasSize) {
    this.historicalCanvasMaxTiledZoom = getMaxTiledZoom(
      historicalCanvasSize,
    );
    this.forceNextRender = true;
    this.updateView(this.store.getState().canvas.view);
  }

  getColorIndexOfPixel(cx, cy, historical = false) {
    if (historical) {
      const state = this.store.getState();
      const {
        historicalDate,
        historicalTime,
        historicalCanvasSize,
      } = state.canvas;
      return this.chunkLoader.getHistoricalIndexOfPixel(cx, cy,
        historicalDate, historicalTime, historicalCanvasSize);
    }
    return this.chunkLoader.getColorIndexOfPixel(cx, cy);
  }

  getPointedColor() {
    const { hover } = this.store.getState().canvas;
    if (!hover) {
      return null;
    }
    return this.getColorIndexOfPixel(...hover);
  }

  updateView(view, origin) {
    let [x, y, scale] = view;
    const state = this.store.getState();
    const { isHistoricalView } = state.canvas;
    const canvasSize = (isHistoricalView)
      ? state.canvas.historicalCanvasSize
      : state.canvas.canvasSize;

    // clamp scale and set viewscale
    if (scale) {
      const minScale = (isHistoricalView) ? 0.7 : TILE_SIZE / canvasSize;
      scale = clamp(view[2], minScale, MAX_SCALE);
      if (origin) {
        let scalediff = this.viewscale;
        // clamp to 1.0 (only when origin is given, so not on phones)
        this.viewscale = (scale > 0.85 && scale < 1.20) ? 1.0 : scale;
        // make sure that origin is at the same place on the screen
        scalediff /= this.viewscale;
        const [px, py] = origin;
        x = px + (x - px) * scalediff;
        y = py + (y - py) * scalediff;
      } else {
        this.viewscale = scale;
      }
    } else {
      [,, scale] = this._view;
    }
    // clamp coords
    const canvasMinXY = -canvasSize / 2;
    const canvasMaxXY = canvasSize / 2 - 1;
    x = clamp(x, canvasMinXY, canvasMaxXY);
    y = clamp(y, canvasMinXY, canvasMaxXY);

    const prevScale = this.view[2];
    super.updateView([x, y, scale]);

    if (prevScale !== scale) {
      const { viewscale } = this;
      pixelNotify.updateScale(viewscale);
      let tiledScale = (viewscale > 0.5)
        ? 0
        : Math.round(Math.log2(viewscale) * 2 / TILE_ZOOM_LEVEL);
      tiledScale = TILE_ZOOM_LEVEL ** tiledScale;
      const canvasMaxTiledZoom = (isHistoricalView)
        ? this.historicalCanvasMaxTiledZoom
        : this.canvasMaxTiledZoom;
      const tiledZoom = canvasMaxTiledZoom + Math.log2(tiledScale)
        * 2 / TILE_ZOOM_LEVEL;
      const relScale = viewscale / tiledScale;
      this.tiledScale = tiledScale;
      this.tiledZoom = tiledZoom;
      this.relScale = relScale;
      if (viewscale < this.scaleThreshold || prevScale < this.scaleThreshold
        || (state.templates.ovEnabled && (
          (prevScale <= OVERLAY_SP_TH && scale > OVERLAY_SP_TH)
          || (prevScale > OVERLAY_SP_TH && scale <= OVERLAY_SP_TH)
        ))) {
        this.forceNextRender = true;
      } else {
        this.forceNextSubrender = true;
      }
    }

    const prevCenterChunk = this.centerChunk;
    const centerChunk = getTileOfPixel(
      this.tiledScale,
      [x, y],
      canvasSize,
    );
    if (!prevCenterChunk
      || prevCenterChunk[0] !== centerChunk[0]
      || prevCenterChunk[1] !== centerChunk[1]
    ) {
      this.centerChunk = centerChunk;
      this.forceNextRender = true;
    } else {
      this.forceNextSubrender = true;
    }
  }

  renderPixel(
    i,
    j,
    offset,
    color,
    notify,
  ) {
    const state = this.store.getState();
    const {
      canvasSize,
      palette,
      isHistoricalView,
    } = state.canvas;
    const scale = this.viewscale;
    this.chunkLoader.getPixelUpdate(i, j, offset, color);

    if (scale < 0.8 || isHistoricalView) return;
    const scaleM = (scale > this.scaleThreshold) ? 1 : scale;

    const context = this.canvas.getContext('2d');
    if (!context) return;

    const [x, y] = getPixelFromChunkOffset(i, j, offset, canvasSize);

    const [canX, canY] = this.centerChunk
      .map((z) => (z + 0.5) * TILE_SIZE - canvasSize / 2);
    const { width: canvasWidth, height: canvasHeight } = this.canvas;
    const px = ((x - canX) * scaleM) + (canvasWidth / 2);
    const py = ((y - canY) * scaleM) + (canvasHeight / 2);
    // if not part of our current canvas, do not render
    if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) return;

    context.fillStyle = palette.colors[color];
    context.fillRect(px, py, scaleM, scaleM);
    if (notify) {
      pixelNotify.addPixel(x, y);
    }

    this.forceNextSubrender = true;
  }


  isChunkInView(
    cz,
    cx,
    cy,
  ) {
    const { tiledZoom } = this;
    if (cz > tiledZoom + 1) {
      return false;
    }

    let [xc, yc] = this.centerChunk;
    let { relScale } = this;
    // adjust for tiledZoom differences
    if (cz !== tiledZoom) {
      const zFac = TILE_ZOOM_LEVEL ** (cz - tiledZoom);
      xc = Math.floor(xc * zFac);
      yc = Math.floor(yc * zFac);
      relScale *= zFac;
    }

    const { width, height } = this.viewport;
    const CHUNK_RENDER_RADIUS_X = Math.ceil(
      width / TILE_SIZE / 2 / relScale,
    );
    const CHUNK_RENDER_RADIUS_Y = Math.ceil(
      height / TILE_SIZE / 2 / relScale,
    );

    if (Math.abs(cx - xc) <= CHUNK_RENDER_RADIUS_X
      && Math.abs(cy - yc) <= CHUNK_RENDER_RADIUS_Y
    ) {
      return true;
    }
    return false;
  }


  renderChunks(
    state,
  ) {
    const context = this.canvas.getContext('2d');
    if (!context) return;

    const {
      centerChunk: chunkPosition,
      tiledScale,
      tiledZoom,
      viewport,
      viewscale: scale,
    } = this;
    const { canvasSize } = state.canvas;

    let { relScale } = this;

    // Disable smoothing
    // making it dependent on the scale is needed for Google Chrome, else
    // scale <1 would look shit
    if (scale >= 1) {
      context.msImageSmoothingEnabled = false;
      context.webkitImageSmoothingEnabled = false;
      context.imageSmoothingEnabled = false;
    } else {
      context.msImageSmoothingEnabled = true;
      context.webkitImageSmoothingEnabled = true;
      context.imageSmoothingEnabled = true;
    }
    // define how many chunks we will render
    // don't render chunks outside of viewport
    const { width, height } = viewport;
    const CHUNK_RENDER_RADIUS_X = Math.ceil(width / TILE_SIZE / 2 / relScale);
    const CHUNK_RENDER_RADIUS_Y = Math.ceil(height / TILE_SIZE / 2 / relScale);
    // If scale is so large that neighbouring chunks wouldn't fit in canvas,
    // do scale = 1 and scale in render()
    if (scale > this.scaleThreshold) relScale = 1.0;
    // scale
    context.save();
    context.fillStyle = BACKGROUND_CLR_HEX;
    context.scale(relScale, relScale);
    // decide if we update the timestamps of accessed chunks
    const curTime = Date.now();
    let touch = false;
    if (curTime > this.lastFetch + 150) {
      this.lastFetch = curTime;
      touch = true;
    }

    const xOffset = this.canvas.width / 2 / relScale - TILE_SIZE / 2;
    const yOffset = this.canvas.height / 2 / relScale - TILE_SIZE / 2;

    const [xc, yc] = chunkPosition; // center chunk
    // CLEAN margin
    // draw new chunks. If not existing, just clear.
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
        const x = xOffset + dx * TILE_SIZE;
        const y = yOffset + dy * TILE_SIZE;

        const chunkMaxXY = canvasSize / TILE_SIZE;
        if (
          cx < 0 || cx >= chunkMaxXY * tiledScale
          || cy < 0 || cy >= chunkMaxXY * tiledScale
        ) {
          // if out of bounds
          context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          chunk = this.chunkLoader.getChunk(tiledZoom, cx, cy);
          // TODO is chunk nnow an object or image? it doesnt make any sense
          if (chunk) {
            context.drawImage(chunk, x, y);
            if (touch) {
              chunk.timestamp = curTime;
            }
          } else {
            context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }
    context.restore();

    if (state.templates.ovEnabled
      && (scale < OVERLAY_SP_TH || !state.templates.oSmallPxls)
    ) {
      renderOverlay(
        state, this.canvas, chunkPosition, scale,
        this.tiledScale, this.scaleThreshold,
      );
    }
  }


  render() {
    if (!this.chunkLoader) {
      return;
    }
    super.render();
    const state = this.store.getState();
    if (state.canvas.isHistoricalView) {
      this.renderHistorical(state);
    } else {
      this.renderMain(state);
    }
  }


  // keep in mind that everything we got here gets executed 60 times per second
  // avoiding unnecessary stuff is important
  renderMain(
    state,
  ) {
    const {
      _view,
      viewport,
      viewscale,
    } = this;
    const {
      showGrid,
      showPixelNotify,
      isPotato,
      isLightGrid,
    } = state.gui;
    const {
      fetchingPixel,
    } = state.fetching;
    const {
      canvasSize,
      hover,
    } = state.canvas;

    const [x, y] = _view;
    const [cx, cy] = this.centerChunk;

    // if we have to render pixelnotify
    const doRenderPixelnotify = (
      viewscale >= 0.5
      && showPixelNotify
      && pixelNotify.doRender()
    );
    // if we have to render placeholder
    const brushSizeMoreThanOne = state.gui.brushSize > 1;
    const doRenderPlaceholder = (
      viewscale >= 3
      && !fetchingPixel
      && (hover || this.hover)
      && (!isPotato && !brushSizeMoreThanOne)
    );
    const doRenderPotatoPlaceholder = (
      viewscale >= 3
      && !fetchingPixel
      && (hover !== this.hover
        || this.forceNextRender
        || this.forceNextSubrender
        || doRenderPixelnotify
      ) && (isPotato || brushSizeMoreThanOne)
    );
    //--
    // if we have nothing to render, return
    // note: this.hover is used to, to render without the placeholder one last
    // time when cursor leaves window
    if (
      // no full rerender
      !this.forceNextRender
      // no render placeholder under cursor
      && !doRenderPlaceholder
      && !doRenderPotatoPlaceholder
      // no pixelnotification
      && !doRenderPixelnotify
      // no forced just-viewscale render (i.e. when just a pixel got set)
      && !this.forceNextSubrender
    ) {
      return;
    }
    this.hover = hover;

    if (this.forceNextRender) {
      this.renderChunks(state);
    }
    this.forceNextRender = false;
    this.forceNextSubrender = false;

    const { width, height } = viewport;
    const viewportCtx = viewport.getContext('2d');
    if (!viewportCtx) return;

    // canvasopt: https://www.html5rocks.com/en/tutorials/canvas/performance/
    viewportCtx.msImageSmoothingEnabled = false;
    viewportCtx.webkitImageSmoothingEnabled = false;
    viewportCtx.imageSmoothingEnabled = false;
    // If scale is so large that neighbouring chunks wouldn't fit in offscreen
    // canvas, do scale = 1 in renderChunks and scale in render()
    const canvasCenter = canvasSize / 2;
    if (viewscale > this.scaleThreshold) {
      viewportCtx.save();
      viewportCtx.scale(viewscale, viewscale);
      viewportCtx.drawImage(
        this.canvas,
        width / 2 / viewscale - this.canvas.width / 2 + (
          (cx + 0.5) * TILE_SIZE - canvasCenter - x),
        height / 2 / viewscale - this.canvas.height / 2 + (
          (cy + 0.5) * TILE_SIZE - canvasCenter - y),
      );
      viewportCtx.restore();
    } else {
      viewportCtx.drawImage(
        this.canvas,
        Math.floor(width / 2 - this.canvas.width / 2
          + ((cx + 0.5) * TILE_SIZE / this.tiledScale
          - canvasCenter - x) * viewscale),
        Math.floor(height / 2 - this.canvas.height / 2
          + ((cy + 0.5) * TILE_SIZE / this.tiledScale
          - canvasCenter - y) * viewscale),
      );
    }

    if (state.templates.ovEnabled
      && state.templates.oSmallPxls && viewscale >= OVERLAY_SP_TH
    ) {
      renderSmallPOverlay(state, viewport, _view, viewscale);
    }

    if (showGrid && viewscale >= 8) {
      renderGrid(state, viewport, _view, viewscale, isLightGrid);
    }

    if (doRenderPixelnotify) {
      pixelNotify.render(state, viewport, _view, viewscale);
    }

    if (hover && doRenderPlaceholder) {
      renderPlaceholder(state, viewport, _view, viewscale);
    }
    if (hover && doRenderPotatoPlaceholder) {
      renderPotatoPlaceholder({
        state,
        $viewport: viewport,
        view: _view,
        scale: viewscale,
      });
    }
  }


  renderHistoricalChunks(
    state,
  ) {
    const context = this.canvas.getContext('2d');
    if (!context) return;

    const {
      centerChunk: chunkPosition,
      viewport,
      viewscale,
      oldHistoricalTime,
    } = this;
    const {
      historicalDate,
      historicalTime,
      historicalCanvasSize,
    } = state.canvas;

    // Disable smoothing
    // making it dependent on the scale is needed for Google Chrome, else
    // scale <1 would look shit
    if (viewscale >= 1) {
      context.msImageSmoothingEnabled = false;
      context.webkitImageSmoothingEnabled = false;
      context.imageSmoothingEnabled = false;
    } else {
      context.msImageSmoothingEnabled = true;
      context.webkitImageSmoothingEnabled = true;
      context.imageSmoothingEnabled = true;
    }

    const scale = (viewscale > this.scaleThreshold) ? 1.0 : viewscale;
    // define how many chunks we will render
    // don't render chunks outside of viewport
    const { width, height } = viewport;
    const CHUNK_RENDER_RADIUS_X = Math.ceil(width / TILE_SIZE / 2 / scale);
    const CHUNK_RENDER_RADIUS_Y = Math.ceil(height / TILE_SIZE / 2 / scale);

    context.save();
    context.fillStyle = BACKGROUND_CLR_HEX;
    // clear canvas and do nothing if no time selected
    if (!historicalDate || !historicalTime) {
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      context.restore();
      return;
    }
    // scale
    context.scale(scale, scale);
    // decide if we update the timestamps of accessed chunks
    const curTime = Date.now();
    let touch = false;
    if (curTime > this.lastFetch + 150) {
      this.lastFetch = curTime;
      touch = true;
    }

    const xOffset = this.canvas.width / 2 / scale - TILE_SIZE / 2;
    const yOffset = this.canvas.height / 2 / scale - TILE_SIZE / 2;

    const [xc, yc] = chunkPosition; // center chunk
    // CLEAN margin
    // draw  chunks. If not existing, just clear.
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
        const x = xOffset + dx * TILE_SIZE;
        const y = yOffset + dy * TILE_SIZE;

        const chunkMaxXY = historicalCanvasSize / TILE_SIZE;
        if (cx < 0 || cx >= chunkMaxXY || cy < 0 || cy >= chunkMaxXY) {
          // if out of bounds
          context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          // full chunks
          chunk = this.chunkLoader
            .getHistoricalChunk(cx, cy, true, historicalDate);
          if (chunk) {
            context.drawImage(chunk, x, y);
            if (touch) {
              chunk.timestamp = curTime;
            }
          } else {
            context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }
          // incremental chunks
          if (historicalTime === '0000') continue;
          chunk = this.chunkLoader
            .getHistoricalChunk(cx, cy, true, historicalDate, historicalTime);
          if (chunk) {
            if (!chunk.isEmpty) {
              context.drawImage(chunk, x, y);
              if (touch) {
                chunk.timestamp = curTime;
              }
            }
          } else if (oldHistoricalTime) {
            chunk = this.chunkLoader
              .getHistoricalChunk(
                cx,
                cy,
                false,
                historicalDate,
                oldHistoricalTime,
              );
            if (chunk && !chunk.isEmpty) {
              context.drawImage(chunk, x, y);
              if (touch) {
                chunk.timestamp = curTime;
              }
            }
          }
        }
      }
    }
    context.restore();
  }


  // keep in mind that everything we got here gets executed 60 times per second
  // avoiding unnecessary stuff is important
  renderHistorical(
    state,
  ) {
    const {
      viewport,
      viewscale,
    } = this;
    const {
      showGrid,
      isLightGrid,
    } = state.gui;
    const {
      historicalCanvasSize,
    } = state.canvas;

    const [x, y] = this._view;
    const [cx, cy] = this.centerChunk;

    if (!this.forceNextRender && !this.forceNextSubrender) {
      return;
    }

    if (this.forceNextRender) {
      this.renderHistoricalChunks(state);
    }
    this.forceNextRender = false;
    this.forceNextSubrender = false;

    const { width, height } = viewport;
    const viewportCtx = viewport.getContext('2d');
    if (!viewportCtx) return;

    viewportCtx.msImageSmoothingEnabled = false;
    viewportCtx.webkitImageSmoothingEnabled = false;
    viewportCtx.imageSmoothingEnabled = false;
    // If scale is so large that neighbouring chunks wouldn't fit in offscreen
    // canvas, do scale = 1 in renderChunks and scale in render()
    const canvasCenter = historicalCanvasSize / 2;
    if (viewscale > this.scaleThreshold) {
      viewportCtx.save();
      viewportCtx.scale(viewscale, viewscale);
      viewportCtx.drawImage(
        this.canvas,
        // eslint-disable-next-line max-len
        width / 2 / viewscale - this.canvas.width / 2 + ((cx + 0.5) * TILE_SIZE - canvasCenter - x),
        // eslint-disable-next-line max-len
        height / 2 / viewscale - this.canvas.height / 2 + ((cy + 0.5) * TILE_SIZE - canvasCenter - y),
      );
      viewportCtx.restore();
    } else {
      viewportCtx.drawImage(
        this.canvas,
        // eslint-disable-next-line max-len
        Math.floor(width / 2 - this.canvas.width / 2 + ((cx + 0.5) * TILE_SIZE - canvasCenter - x) * viewscale),
        // eslint-disable-next-line max-len
        Math.floor(height / 2 - this.canvas.height / 2 + ((cy + 0.5) * TILE_SIZE - canvasCenter - y) * viewscale),
      );
    }

    if (showGrid && viewscale >= 8) {
      renderGrid(state, viewport, this._view, viewscale, isLightGrid);
    }
  }
}


export default Renderer2D;
