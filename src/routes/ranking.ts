/*
 * send global ranking
 */

import type { Handler } from 'express';
import rankings from '../core/Ranks.js';

const route: Handler = (req, res) => {
  req.tickRateLimiter(1000);

  res.set({
    'Cache-Control': 'public, s-maxage=180, max-age=280',
  });
  res.json(rankings.ranks);
};

export default route;