/*
 * return canvases
 */
import getLocalizedCanvases, {
  defaultCanvasForCountry,
} from '../../canvasesDesc.js';
import { DEFAULT_CANVAS_ID } from '../../core/constants.ts';

export default async function getiid(req, res) {
  req.tickRateLimiter(3000);

  res.set({
    'Cache-Control': 'public, s-maxage=180, max-age=280',
  });

  res.status(200).json({
    canvases: getLocalizedCanvases(req.lang),
    defaultCanvas: defaultCanvasForCountry[req.ip.country] || DEFAULT_CANVAS_ID,
  });
}
