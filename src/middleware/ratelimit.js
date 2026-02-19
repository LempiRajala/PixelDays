/*
 * rate limiter,
 * must have req.ip available
 */
import { spawn } from 'child_process';

import MassRateLimiter from '../utils/MassRateLimiter.js';
import { MINUTE } from '../core/constants.ts';
import { RATE_LIMIT_CMD } from '../core/config.js';

const rateLimiter = new MassRateLimiter(MINUTE);

function onTrigger(ipString) {
  console.warn(`User ${ipString} triggered Request RateLimit.`);
  if (RATE_LIMIT_CMD) {
    const args = RATE_LIMIT_CMD.split(' ');
    let cmd = args.shift();
    args.push(ipString);
    cmd = spawn(cmd, args);
    cmd.stdout.on('data', (data) => {
      console.log(`RateLimit Trigger: ${data}`);
    });
    cmd.stderr.on('data', (data) => {
      console.error(`RateLimit Trigger Error: ${data}`);
    });
  }
}

export default (req, res, next) => {
  if (rateLimiter.isTriggered(req.ip.ipString)) {
    res.status(429).send(`<!DOCTYPE html>
<html>
  <head><title>Too fast</title></head>
  <body>Calm Down a bit.</body>
</html>`);
    return;
  }
  req.tickRateLimiter = (deltaTime) => {
    /*
     * the ticking request will be answered, if the limiter triggers, the next
     * request is the first to be caught
     */
    rateLimiter.tick(req.ip.ipString, deltaTime, null, onTrigger);
  };
  next();
};
