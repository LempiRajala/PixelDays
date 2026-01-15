/*
 * Creation of JS Challenges in a Worker
 * This is equivalent to the creation of Captchas in captchaserver.js
 */

import path from 'path';
import { Worker } from 'worker_threads';

import logger from './logger.js';
import { IS_BUNDLE } from './config.js';

const MAX_WAIT = 30 * 1000;

/*
 * worker thread
 */
// const worker =
//   IS_BUNDLE
//   ? new Worker(path.resolve('workers', 'challengeloader.js'))
//   : new Worker(path.resolve('src', 'workers', 'challengeloader.js'));
const worker =new Worker(path.resolve('src', 'workers', 'challengeloader.js'));

/*
 * queue of challenge-generation tasks
 * [[ timestamp, callbackFunction ],...]
 */
const challengeQueue = [];

/*
 * generate a challenge in the worker thread
 * calls callback with arguments:
 *  (error, challenge.result, challenge.data)
 */
function requestChallenge(cb) {
  worker.postMessage('createChallenge');
  challengeQueue.push([Date.now(), cb]);
}

/*
 * answer of worker thread
 */
worker.on('message', (msg) => {
  while (challengeQueue.length) {
    const task = challengeQueue.shift();
    try {
      task[1](...msg);
      return;
    } catch {
      // continue
    }
  }
});

/*
 * clear requests if queue can't keep up
 */
function clearOldQueue() {
  const now = Date.now();
  if (challengeQueue.length
    && now - challengeQueue[0][0] > MAX_WAIT
  ) {
    logger.warn('CHALLENGES Queue can not keep up!');
    challengeQueue.forEach((task) => {
      try {
        task[1]('TIMEOUT');
      } catch {
        // nothing
      }
    });
    challengeQueue.length = 0;
  }
}

setInterval(clearOldQueue, MAX_WAIT);

export default requestChallenge;
