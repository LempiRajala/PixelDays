/*
 * send information about next void
 */

import type { Handler } from 'express';
import { getState } from '../core/SharedState.js';

const route: Handler = (req, res) => {
  req.tickRateLimiter(1000);

  res.set({
    'Cache-Control': `public, max-age=${5 * 60}`,
  });

  const eventTimestamp = getState().void?.eventTimestamp;

  if (eventTimestamp) {
    const time = new Date(eventTimestamp);
    res.send(`Next void at ${time.toUTCString()}`);
  } else {
    res.send('No void');
  }
};

export default route;