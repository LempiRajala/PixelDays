/**
 *
 */
import express from 'express';
import path from 'path';

import ranking from './ranking.js';
import voidl from './void.js';
import history from './history.js';
import tiles from './tiles.js';
import chunks from './chunks.js';
import captcha from './captcha.js';
import challenge from './challenge.js';
import resetPassword from './reset_password.js';
import api from './api/index.js';
import oidc from './oidc/index.js';
import tp from './tp.js';

import { getJWKS } from '../core/jwt.js';
import { expressTTag } from '../middleware/ttag.js';
import cors from '../middleware/cors.js';
import { parseIP } from '../middleware/ip.js';
import rateLimiter from '../middleware/ratelimit.js';
import generateGlobePage from '../ssr/Globe.jsx';
import generatePopUpPage from '../ssr/PopUp.jsx';
import generateMainPage from '../ssr/Main.jsx';

import { MONTH, AVAILABLE_POPUPS } from '../core/constants.ts';
import {
  CHAT_INVITE, BASENAME, CDN_HOST, OIDC_URL,
} from '../core/config.js';

const router = express.Router();

/*
 * if we are running on a path, we throw in a router in between
 */
const basenameRouter = (BASENAME) ? express.Router() : router;
if (BASENAME) {
  basenameRouter.use(BASENAME, router);
  basenameRouter.get('/', (req, res) => {
    /* eslint-disable max-len */
    res.status(404).send(`<!DOCTYPE html>
<html>
  <head><title>Not Here</title></head>
  <body>Pixelplanet is available under: <a href="${BASENAME}">${BASENAME}</a></body>
</html>`);
    /* eslint-enable max-len */
  });
}

const expressStatic = express.static(
  path.join(__dirname, 'public'), {
    maxAge: 12 * MONTH,
    extensions: ['html'],
    setHeaders: (res, reqPath) => {
      if (reqPath.includes('/legal')) {
        res.setHeader('Cache-Control', `public, max-age=${3 * 24 * 3600}`);
      }
    },
  },
);

if (OIDC_URL) {
  router.get('/.well-known/openid-configuration', (req, res) => {
    const baseUrl = OIDC_URL + BASENAME;
    res.set({
      'Cache-Control': `public, max-age=${24 * 3600}`,
      'Access-Control-Allow-Origin': '*',
    });
    res.json({
      issuer: OIDC_URL,
      authorization_endpoint: `${baseUrl}/oidc/auth`,
      token_endpoint: `${baseUrl}/oidc/token`,
      userinfo_endpoint: `${baseUrl}/oidc/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: [
        'openid', 'email', 'profile', 'offline_access', 'game_data',
        'achievements',
      ],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic', 'client_secret_post',
      ],
      request_object_signing_alg_values_supported: ['none'],
    });
  });
  router.get('/.well-known/jwks.json', async (req, res) => {
    res.set({
      'Cache-Control': `public, max-age=${24 * 3600}`,
      'Access-Control-Allow-Origin': '*',
    });
    res.json({ keys: await getJWKS() });
  });
}

/* ip */
router.use(parseIP);

/* translations */
router.use(expressTTag);

/*
 * Serving Chunks
 */
router.get(['/chunks/:c/:x/:y/:z.bmp', '/chunks/:c/:x/:y.bmp'], chunks);

/*
 * zoomed tiles
 */
router.use('/tiles', tiles);

/*
 * test path to check connectivity
 */
router.get('/test', (req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.status(200).end();
});

router.use(rateLimiter);

/*
 * Redirect to chat
 */
router.use('/guilded', (req, res) => {
  res.redirect(CHAT_INVITE);
});

/*
 * Following with CORS,
 * this also means that all the landing pages are CORS, which is weird,
 * but it is the simplest way to make CDN_URL CORS aware
 */
router.use(cors);

/*
 * if we get accessed by CDN, only serve static files
 */
router.use((req, res, next) => {
  if (CDN_HOST && CDN_HOST === req.ip.getHost(false, false)) {
    req.tickRateLimiter(600);
    expressStatic(req, res, () => {
      if (!res.headersSent) {
        res.status(404).send(`<!DOCTYPE html>
<html>
  <head><title>Not here</title></head>
  <body>This domain is used as a CDN. You can't access anything here.</body>
</html>`);
      }
    });
    return;
  }
  next();
});

//
// 3D Globe (react generated)
// -----------------------------------------------------------------------------
router.get('/globe', (req, res) => {
  req.tickRateLimiter(3000);

  const { html, etag: globeEtag } = generateGlobePage(req);

  res.set({
    'Cache-Control': 'private, no-cache', // seconds
    ETag: globeEtag,
  });

  if (!html) {
    res.status(304).end();
    return;
  }

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

//
// PopUps
// -----------------------------------------------------------------------------
router.use(
  AVAILABLE_POPUPS.map((p) => `/${p.toLowerCase()}`),
  (req, res) => {
    req.tickRateLimiter(3000);

    const { html, etag: winEtag } = generatePopUpPage(req);

    res.set({
      'Cache-Control': 'private, no-cache', // seconds
      ETag: winEtag,
    });

    if (!html) {
      res.status(304).end();
      return;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  },
);

//
// Main Page
// -----------------------------------------------------------------------------
router.get('/', (req, res) => {
  req.tickRateLimiter(3000);

  const { html, csp, etag: mainEtag } = generateMainPage(req);

  res.set({
    'Cache-Control': 'private, no-cache', // seconds
    'Content-Security-Policy': csp,
    ETag: mainEtag,
  });

  if (!html) {
    res.status(304).end();
    return;
  }

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.status(200).send(html);
});


/*
 * Password Reset Link
 */
router.use('/reset_password', resetPassword);

/*
 * API calls
 */
router.use('/api', api);

/*
 * oauth logins
 */
router.use('/tp', tp);

/*
 * OpenID Connect Provider (OP)
 */
if (OIDC_URL) {
  router.use('/oidc', oidc);
}

/*
 * void info
 */
router.get('/void', voidl);

/*
 * ranking of pixels placed
 * daily and total
 */
router.get('/ranking', ranking);

/*
 * give: date per query
 * returns: array of HHMM backups available
 */
router.get('/history', history);

/*
 * serve captcha
 */
router.get('/captcha.svg', captcha);

/*
 * serve js challenge
 */
router.get('/challenge.js', challenge);

router.use((req, res, next) => {
  req.tickRateLimiter(600);
  next();
});

/*
 * public folder
 */
router.use(expressStatic);

export default basenameRouter;
