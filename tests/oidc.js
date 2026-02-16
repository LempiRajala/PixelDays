/*
 * test OIDC Provider implementation
 */

import express from 'express';
import http from 'http';
import { QueryTypes } from 'sequelize';

import {
  OAuth2Client, generateCodeVerifier, decodeIdToken, CodeChallengeMethod,
} from 'arctic';

import { sequelize, sync as syncSql } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { destructAllWatchers } from '../src/core/fsWatcher.js';
const LOG_QUERY = false;
const SYNC_MYSQL = false;

import { generateIdToken } from '../src/middleware/oidc.js';
import { createOIDCClient } from '../src/data/sql/OIDCClient.js';
import { generateTinyToken } from '../src/utils/hash.js';

function title(title, spacer = '=') {
  const spacerAmount = Math.floor((80 - title.length - 2) / 2);
  let out = spacer.repeat(spacerAmount) + ' ' + title + ' ' + spacer.repeat(spacerAmount);
  if ((80 - title.length - 2) % 2) out += spacer;
  console.log(out);
}

function fail(message, value) {
  console.log(value);
  throw new Error(message);
}

async function initialize() {
  await syncSql(SYNC_MYSQL);
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
  destructAllWatchers();
}

let scopes = ['openid', 'email', 'user_id'];
// scopes = ['profile'];

(async () => {
  await initialize();

  let lsql;
  sequelize.options.logging = (sql, timing) => {
    if (LOG_QUERY) {
      console.log(sql);
    }
    lsql = sql;
  };

  title('launch expressjs app on localhost:33333');
  console.log(
    'A test instance of pixeldays needs to be running at localhost:5000 with OIDC_URL=http://localhost:5000 and HOST=127.0.0.1',
  );
  const app = express();
  const server = http.createServer(app);
  server.listen(33333, 'localhost');

  try {
    title('generate oidc client');
    let clientId;
    let clientSecret;
    try {
      ({ clientId, clientSecret } = await createOIDCClient(1, 'test', scopes, ['http://localhost:33333/r'], null, false));
    } catch {
      const oidcClient = await sequelize.query(
        // eslint-disable-next-line max-len
        'SELECT uid, BIN_TO_UUID(uuid) AS uuid FROM OIDCClients WHERE name = ?', {
          replacements: ['test'],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );
      ({ clientId, clientSecret } = await createOIDCClient(oidcClient.uid, 'test', scopes, ['http://localhost:33333/r'], null, null, oidcClient.uuid, false));
    }
    console.log('id', clientId, 'secret', clientSecret);

    title('initialize routes for oidc client');
    let response = await fetch(`http:/localhost:5000/.well-known/openid-configuration`);
    const { authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri } = await response.json();
    console.log('Autodiscovered configuration:', [authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri]);

    const provider = new OAuth2Client(clientId, clientSecret, 'http://localhost:33333/r');

    const state = generateTinyToken();
    const codeVerifier = generateCodeVerifier();

    app.get('/', (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Expires: '0',
      });
      let url = provider.createAuthorizationURLWithPKCE(
        authorization_endpoint, state,
        CodeChallengeMethod.S256, codeVerifier, scopes,
      );
      url = url.toString();
      console.log('redirected client to:', url);
      res.redirect(url);
    });

    app.get('/r', async (req, res) => {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Expires: '0',
      });
      console.log('client comming back to:', req.protocol + '://' + req.get('host') + req.originalUrl);
      const { query } = req;
      if (query.error) {
        if (query.error_description) {
          const error = new Error(query.error_description);
          error.title = query.error;
          throw error;
        }
        throw new Error(query.error);
      }
      const { state, code } = query;
      let tokens = await provider.validateAuthorizationCode(token_endpoint, code, codeVerifier);
      console.log('tokens', tokens);

      let claims;
      if (scopes.includes('openid')) {
        const claims = decodeIdToken(tokens.idToken());
        console.log('claims', claims);
      }
      if (scopes.includes('offline_access')) {
        const refreshToken = tokens.refreshToken();
        tokens = await provider.refreshAccessToken(token_endpoint, refreshToken, []);
        console.log('refreshed_tokens', tokens);
      }

      let user = await fetch(userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      });
      user = await user.json();

      console.log('modtools');
      response = await fetch('http://localhost:5000/api/modtools', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      });
      console.log('return', await response.text(), '\n', response.headers.get('WWW-Authenticate'));

      res.json({ id_token: claims, user });
    });

    console.log('Visit http://localhost:33333/ to test the authentication flow');

  } catch (error) {
    console.error(error.message);
    console.error(lsql);

    title('close expressjs app');
    await destruct();
    server.close();
  }
})();
