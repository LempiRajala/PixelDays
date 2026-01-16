/*
 * placeholder that shows underneath cursor
 *
 */

import templateLoader from './templateLoader.js';
import { screenToWorld, worldToScreen } from '../core/utils.js';
import { TILE_SIZE } from '../core/constants.js';

const PLACEHOLDER_SIZE = 1.2;
const PLACEHOLDER_BORDER = 1;

export function renderPlaceholder(
  state,
  $viewport,
  view,
  scale,
) {
  const viewportCtx = $viewport.getContext('2d');

  const { hover, palette, selectedColor } = state.canvas;

  const [sx, sy] = worldToScreen(view, scale, $viewport, hover);

  viewportCtx.save();
  viewportCtx.translate(sx + (scale / 2), sy + (scale / 2));
  const angle = Math.sin(Date.now() / 250) / 4;
  viewportCtx.rotate(angle);
  viewportCtx.fillStyle = '#000';
  viewportCtx.fillRect(
    -(scale * (PLACEHOLDER_SIZE / 2)) - PLACEHOLDER_BORDER,
    -(scale * (PLACEHOLDER_SIZE / 2)) - PLACEHOLDER_BORDER,
    (scale * PLACEHOLDER_SIZE) + (2 * PLACEHOLDER_BORDER),
    (scale * PLACEHOLDER_SIZE) + (2 * PLACEHOLDER_BORDER),
  );
  viewportCtx.fillStyle = palette.colors[selectedColor];
  viewportCtx.fillRect(
    -scale * (PLACEHOLDER_SIZE / 2),
    -scale * (PLACEHOLDER_SIZE / 2),
    scale * PLACEHOLDER_SIZE,
    scale * PLACEHOLDER_SIZE,
  );
  viewportCtx.restore();
}

export function renderPotatoPlaceholder({
  state,
  $viewport,
  view,
  scale,
}) {
  const viewportCtx = $viewport.getContext('2d');
  const hover = state.canvas.hover;
  const size = state.gui.brushSize;

  const [x1, y1] = worldToScreen(view, scale, $viewport, [hover[0] - (size >> 1), hover[1] - (size >> 1)]);
  const [x2, y2] = worldToScreen(view, scale, $viewport, [hover[0] + 1 + (size >> 1), hover[1] + 1 + (size >> 1)]);

  viewportCtx.save();

  viewportCtx.fillStyle = '#000';
  viewportCtx.lineWidth = 4;
  viewportCtx.beginPath();
  viewportCtx.moveTo(x1, y1);
  viewportCtx.lineTo(x2, y1);
  viewportCtx.lineTo(x2, y2);
  viewportCtx.lineTo(x1, y2);
  viewportCtx.lineTo(x1, y1);
  viewportCtx.lineTo(x2, y1);
  viewportCtx.stroke();

  viewportCtx.restore();
}


export function renderGrid(
  state,
  $viewport,
  view,
  scale,
  isLightGrid,
) {
  const { width, height } = $viewport;

  const viewportCtx = $viewport.getContext('2d');
  if (!viewportCtx) return;

  viewportCtx.globalAlpha = 0.5;
  viewportCtx.fillStyle = (isLightGrid) ? '#DDDDDD' : '#222222';

  let [xoff, yoff] = screenToWorld(view, scale, $viewport, [0, 0])
    .map(Math.floor);
  let [x, y] = worldToScreen(view, scale, $viewport, [xoff, yoff]);

  for (; x < width; x += scale) {
    const thick = (xoff++ % 10 === 0) ? 2 : 1;
    viewportCtx.fillRect(x, 0, thick, height);
  }

  for (; y < height; y += scale) {
    const thick = (yoff++ % 10 === 0) ? 2 : 1;
    viewportCtx.fillRect(0, y, width, thick);
  }

  viewportCtx.globalAlpha = 1;
}

/*
 * Overlay draws onto offscreen canvas, so its doing weirder math
 */
export function renderOverlay(
  state,
  $canvas,
  centerChunk,
  scale,
  tiledScale,
  scaleThreshold,
) {
  if (!templateLoader.ready || scale < 0.035) return;
  const { canvasSize, canvasId } = state.canvas;
  // world coordinates of center of center chunk
  const [x, y] = centerChunk
    .map((z) => z * TILE_SIZE / tiledScale
    + TILE_SIZE / 2 / tiledScale - canvasSize / 2);

  // if scale > scaleThreshold, then scaling happens in renderer
  // instead of offscreen canvas
  const offscreenScale = (scale > scaleThreshold) ? 1.0 : scale;

  const { width, height } = $canvas;
  const horizontalRadius = width / 2 / offscreenScale;
  const verticalRadius = height / 2 / offscreenScale;
  const templates = templateLoader.getTemplatesInView(
    canvasId, x, y, horizontalRadius, verticalRadius,
  );

  if (!templates.length) return;
  const context = $canvas.getContext('2d');
  if (!context) return;

  context.imageSmoothingEnabled = false;
  context.save();
  context.scale(offscreenScale, offscreenScale);
  context.globalAlpha = state.templates.oOpacity / 100;
  for (const template of templates) {
    if (template.width * offscreenScale < 1
      || template.height * offscreenScale < 1
    ) continue;

    const image = templateLoader.getTemplateSync(template.imageId);
    if (!image) continue;

    context.drawImage(
      image,
      template.x - x + width / 2 / offscreenScale,
      template.y - y + height / 2 / offscreenScale,
    );
  }
  context.restore();
}

/*
 * Small pixel overlay draws into viewport, because it needs
 * high scale values
 */
export function renderSmallPOverlay(
  state,
  $viewport,
  view,
  scale,
) {
  if (!templateLoader.ready) return;
  const { canvasId } = state.canvas;
  const [x, y] = view;
  const { width, height } = $viewport;
  const horizontalRadius = width / 2 / scale;
  const verticalRadius = height / 2 / scale;
  const templates = templateLoader.getTemplatesInView(
    canvasId, x, y, horizontalRadius, verticalRadius,
  );

  if (!templates.length) return;
  const context = $viewport.getContext('2d');
  if (!context) return;

  const relScale = scale / 3;
  context.imageSmoothingEnabled = false;
  context.save();
  context.scale(relScale, relScale);
  for (const template of templates) {
    const image = templateLoader.getSmallTemplateSync(template.imageId);
    if (!image) continue;
    context.drawImage(image,
      (template.x - x) * 3 + width / 2 / relScale,
      (template.y - y) * 3 + height / 2 / relScale,
    );
  }
  context.restore();
}
