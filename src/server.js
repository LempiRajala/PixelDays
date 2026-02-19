/*
 * Entrypoint for main server script
 */

import url from 'url';
import compression from 'compression';
import express from 'express';
import http from 'http';

import forceGC from './core/forceGC.ts';
import logger from './core/logger.js';
import rankings from './core/Ranks.js';
import { sync as syncSql } from './data/sql/sequelize.js';
import { connect as connectRedis } from './data/redis/client.js';
import routes from './routes/index.js';
import chatProvider from './core/ChatProvider.js';
import rpgEvent from './core/RpgEvent.js';
import { initialize as initializeFishing } from './core/Fishing.js';
import canvasCleaner from './core/CanvasCleaner.js';
import mailProvider from './core/MailProvider.js';
import { User } from './middleware/session.js';

import socketEvents from './socket/socketEvents.js';
import SocketServer from './socket/SocketServer.js';
import APISocketServer from './socket/APISocketServer.js';

import {
  PORT, HOST, HOURLY_EVENT, FISHING, BASENAME,
} from './core/config.js';
import { SECOND } from './core/constants.ts';

import startAllCanvasLoops from './core/tileserver.js';

/*
 * in final bundle make sure to cd to dir of script, just because
 */
if (process.env.NODE_ENV && __dirname) {
  process.chdir(__dirname);
}

const app = express();
app.disable('x-powered-by');


// Call Garbage Collector every 30 seconds
setInterval(forceGC, 10 * 60 * SECOND);

// create http server
const server = http.createServer(app);

//
// websockets
// -----------------------------------------------------------------------------
const usersocket = new SocketServer();
const apisocket = new APISocketServer();
const wsUrl = `${BASENAME}/ws`;
const apiWsUrl = `${BASENAME}/mcws`;
async function wsupgrade(request, socket, head) {
  const { pathname } = url.parse(request.url);
  try {
    if (pathname === wsUrl) {
      await usersocket.handleUpgrade(request, socket, head);
    } else if (pathname === apiWsUrl) {
      await apisocket.handleUpgrade(request, socket, head);
    } else {
      socket.write('HTTP/1.1 404 Not found\r\n\r\n');
      socket.destroy();
    }
  } catch (err) {
    logger.error(`WebSocket upgrade error: ${err.message}`);
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
  }
}
server.on('upgrade', wsupgrade);

/*
 * use gzip compression for following calls
 * level from -1 (default, 6) to 0 (no) from 1 (fastest) to 9 (best)
 *
 * Set custom filter to make sure that .bmp files get compressed
 */
app.use(compression({
  level: 3,
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type');
    if (contentType === 'application/octet-stream') {
      return true;
    }
    return compression.filter(req, res);
  },
}));

app.use(routes);

//
// ip config
// -----------------------------------------------------------------------------
// sync sql models
syncSql()
  // connect to redis
  .then(connectRedis)
  .then(async () => {
    User.setMailProvider(mailProvider);
    chatProvider.initialize();
    await startAllCanvasLoops();
    usersocket.initialize();
    apisocket.initialize();
    canvasCleaner.initialize();
    // start http server
    const startServer = () => {
      server.listen(PORT, HOST, () => {
        logger.info(
          'info',
          `HTTP Server listening on port ${PORT}`,
        );
      });
    };
    startServer();
    // catch errors of server
    server.on('error', (e) => {
      logger.error(
        `HTTP Server Error ${e.code} occurred, trying again in 5s...`,
      );
      setTimeout(() => {
        server.close();
        startServer();
      }, 5000);
    });
  })
  .then(async () => {
    await socketEvents.initialize();
  })
  .then(async () => {
    /*
     * initializers that rely on the cluster being fully established
     * i.e. to know if it is the shard that runs the event
     */
    if (socketEvents.isCluster && socketEvents.important) {
      logger.info('I am the main shard');
    }
    rankings.initialize();
    if (HOURLY_EVENT) {
      /*
       * give us 10s extra of negotating shards,
       * TODO: initialize RpgEvent either in a redis lua function or in a
       * single transaction, so we can not clash with other shards
       */
      setTimeout(() => {
        rpgEvent.initialize();
      }, 10000);
    }
    if (FISHING) {
      initializeFishing();
    }
  });
