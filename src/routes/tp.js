/*
 * third party logins with passport
 */
import express from 'express';
import { parse as parseCookie } from 'cookie';
import {
  OAuth2Client, Discord, Google, generateCodeVerifier, decodeIdToken,
  CodeChallengeMethod, OAuth2Tokens,
} from 'arctic';

import { sign, unsign, generateTinyToken } from '../utils/hash.js';
import { openSession } from '../middleware/session.js';
import { parseDevice } from '../middleware/device.js';
import errorPage from '../middleware/errorPage.js';
import socketEvents from '../socket/socketEvents.js';
import { sanitizeName, validateEMail } from '../utils/validation.js';
import {
  getUserByEmail, getUserByTpid, getNameThatIsNotTaken, createNewUser,
  setUserLvl,
} from '../data/sql/User.js';
import { addOrReplaceTpid } from '../data/sql/ThreePID.js';

import {
  THREEPID_ABBR, USERLVL, THREEPID_PROVIDERS,
} from '../core/constants.ts';
import {
  DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_R_URI,
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_R_URI,
  VK_CLIENT_ID, VK_CLIENT_SECRET, VK_R_URI,
} from '../core/config.js';

const router = express.Router();

/*
 * available providers
 */
const abbrToProvider = {
  /* eslint-disable max-len */
  d: DISCORD_CLIENT_ID && new Discord(DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_R_URI),
  g: GOOGLE_CLIENT_ID && new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_R_URI),
  vk: VK_CLIENT_ID && new OAuth2Client(VK_CLIENT_ID, VK_CLIENT_SECRET, VK_R_URI),
  /* eslint-enable max-len */
};

/*
 * get into auth flow
 */
router.get('/:abbr', (req, res) => {
  req.tickRateLimiter(5000);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });

  const provider = abbrToProvider[req.params.abbr];
  if (!provider) {
    throw new Error('No such oauth provider configured');
  }

  const state = generateTinyToken();
  /* origin is given by the client, its where we redirect back after login */
  const origin = req.query.o || '/';
  /*
   * pkce challenge, would be better to store it in a database, but a signed
   * cookie shall be alright, especially since others don't use it at all
   */
  const codeVerifier = generateCodeVerifier();

  res.cookie(`oa${state}`, sign(`${codeVerifier}:${origin}`), {
    httpOnly: true,
    secure: false,
    expires: new Date(Date.now() + 900 * 1000),
    sameSite: 'lax',
  });

  let url;
  switch (req.params.abbr) {
    case 'd': {
      const scopes = ['identify', 'email'];
      url = provider.createAuthorizationURL(state, codeVerifier, scopes);
      break;
    }
    case 'g': {
      const scopes = ['openid', 'email', 'profile'];
      url = provider.createAuthorizationURL(state, codeVerifier, scopes);
      break;
    }
    case 'vk': {
      const scopes = ['email'];
      url = provider.createAuthorizationURLWithPKCE(
        'https://id.vk.com/authorize', state,
        CodeChallengeMethod.S256, codeVerifier, scopes,
      );
      break;
    }
    default:
      // nothing
  }

  res.redirect(url.toString());
});

/*
 * return from oauth
 */
router.get('/r/:abbr', parseDevice, async (req, res) => {
  req.tickRateLimiter(7000);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });

  const provider = abbrToProvider[req.params.abbr];
  if (!provider) {
    throw new Error('No such oauth provider configured');
  }

  const { query } = req;
  const { state } = query;

  const cookies = parseCookie(req.headers.cookie || '');
  const cookieName = `oa${state}`;
  const oauthCookie = unsign(cookies[cookieName]);
  res.clearCookie(cookieName, {
    httpOnly: true, secure: false, sameSite: 'lax',
  });

  /* eslint-disable max-len */
  if (!oauthCookie) {
    throw new Error(
      'Either your browser does not support cookies or the third party provider sent a bad return.',
    );
  }

  if (query.error) {
    if (query.error_description) {
      const error = new Error(query.error_description);
      error.title = query.error;
      throw error;
    }
    throw new Error(query.error);
  }

  const seperator = oauthCookie.indexOf(':');
  if (seperator === -1) {
    throw new Error(
      'I do not know how this can even happen without you deliberately messing with it',
    );
  }
  const codeVerifier = oauthCookie.substring(0, seperator);
  let origin = oauthCookie.substring(seperator + 1);
  if (!origin) {
    origin = '/';
  }
  const { code } = query;
  const providerName = THREEPID_ABBR[req.params.abbr];

  let tpid;
  let email;
  let emailVerified = false;
  let tpidVerified = false;
  let preferredName;
  /*
   * we get avtarUrl, but we do not use it (yet),
   * Reminder that people do not like or even expect to share their profile pic
   * when they do a third party login, they expect a login only.
   * If we ever use it, we need to ask for explicit consent.
   */
  /* eslint-disable no-unused-vars */
  let avatarUrl;
  switch (req.params.abbr) {
    case 'd': {
      /*
       * https://discord.com/developers/docs/topics/oauth2
       */
      const tokens = await provider.validateAuthorizationCode(code, codeVerifier);
      const accessToken = tokens.accessToken();
      const response = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = await response.json();
      ({
        username: preferredName, email, id: tpid,
      } = user);
      if (user.verified) {
        emailVerified = true;
        tpidVerified = true;
      }
      avatarUrl = `https://cdn.discordapp.com/avatars/${tpid}/${user.avatar}.png`;
      break;
    }
    case 'g': {
      /*
       * generic OpenID Connect flow
       * https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload
       */
      const tokens = await provider.validateAuthorizationCode(code, codeVerifier);
      const claims = decodeIdToken(tokens.idToken());
      ({
        sub: tpid,
        email,
        email_verified: emailVerified,
        name: preferredName,
        picture: avatarUrl,
      } = claims);
      if (emailVerified) {
        tpidVerified = true;
      }
      break;
    }
    case 'vk': {
      /*
       * Some own thing, not really OIDC, but close
       * https://id.vk.com/about/business/go/docs/en/vkid/latest/vk-id/connection/start-integration/auth-without-sdk/auth-without-sdk-web
       */
      let body = new URLSearchParams();
      body.set('grant_type', 'authorization_code');
      body.set('code_verifier', codeVerifier);
      body.set('redirect_uri', VK_R_URI);
      body.set('code', code);
      body.set('client_id', VK_CLIENT_ID);
      /*
       * this stops it from being oidc, together with the missing Authorization
       * header
       */
      body.set('device_id', query.device_id);
      body.set('state', state);

      let response = await fetch('https://id.vk.com/oauth2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'ppfun',
        },
        body: body.toString(),
      });
      response = await response.json();
      if (response.error) {
        throw new Error(response.error_description || response.error);
      }
      const tokens = new OAuth2Tokens(response);

      body = new URLSearchParams();
      body.set('access_token', tokens.accessToken());
      body.set('client_id', VK_CLIENT_ID);
      response = await fetch('https://id.vk.com/oauth2/user_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'ppfun',
        },
        body: body.toString(),
      });
      response = await response.json();
      if (response.error) {
        throw new Error(response.error_description || response.error);
      }
      const { user } = response;
      ({
        email, user_id: tpid, avatar: avatarUrl,
      } = user);
      if (user.verified) {
        emailVerified = true;
      }
      /*
       * vk account creation is so restrictive, consider it verified if it
       * exists
       */
      tpidVerified = true;
      preferredName = user.first_name;
      if (user.last_name) {
        preferredName += ` ${user.last_name.charAt(0)}.`;
      }
      break;
    }
    default:
      // nothing
  }
  /* eslint-enable no-unused-vars */
  /* eslint-enable max-len */

  /*
   * the fun starts here, we now got the third party data, verify it
   */

  if (tpid && typeof tpid !== 'string') {
    tpid = tpid.toString();
  }
  /* don't accept emails that aren't verified */
  if (!emailVerified) {
    email = null;
  }
  /* make sure name and email have proper format */
  preferredName = sanitizeName(preferredName);
  if (email?.length > 40 || validateEMail(email)) {
    email = null;
  }

  const providerType = THREEPID_PROVIDERS[providerName];
  if (!providerType) {
    throw new Error(`Can not login with ${providerName}`);
  }
  if (!email && !tpid) {
    throw new Error(
      // eslint-disable-next-line max-len
      `${providerName} didn't give us enough information to log you in, maybe you don't have an email set in their account?`,
    );
  }

  /*
   * get or create the user account
   */

  const promises = [];
  let userData;
  /* try with associated email if it is verified */
  if (email && emailVerified) {
    userData = await getUserByEmail(email);
  }
  /* try with tpid */
  if (!userData && tpid) {
    userData = await getUserByTpid(providerType, tpid);
  }
  /* create new user */
  if (!userData) {
    preferredName = await getNameThatIsNotTaken(preferredName);
    console.log(
      // eslint-disable-next-line max-len
      `TP LOGIN: Create new user from ${providerName} oauth login ${tpid}`,
    );
    userData = await createNewUser(preferredName, null);
    if (!userData) {
      throw new Error('Could not create user');
    }
  }

  if (tpid) {
    promises.push(
      addOrReplaceTpid(userData.id, providerType, tpid, tpidVerified),
    );
  }
  if (email && emailVerified) {
    promises.push(
      addOrReplaceTpid(userData.id, THREEPID_PROVIDERS.EMAIL, email),
    );
  }
  if ((tpidVerified || emailVerified)
    && userData.userlvl === USERLVL.REGISTERED
  ) {
    promises.push(setUserLvl(userData.id, USERLVL.VERIFIED));
  }
  await Promise.all(promises);

  /*
   * at this point we have userData of { id, name, password, userlvl }
   */

  /* creates req.user */
  await openSession(req, res, userData.id, 168);

  /*
  * on logins for openid connect reauthentification, we should split the
  * promt='login' from the query, to indicate that we authenticated, and add
  * max_age, to make sure that it is recent
  */
  if (origin.startsWith('/oidc/')) {
    const url = new URL(origin, 'http://example.com');
    if (url.searchParams.get('prompt') === 'login') {
      url.searchParams.delete('prompt');
      url.searchParams.set('max_age', '600');
      origin = url.pathname + url.search;
    }
  }

  /* tell all clients of this ip to reload */
  res.on('finish', () => socketEvents.reloadIP(req.ip.ipString));
  res.redirect(origin);
});

router.use(errorPage);

export default router;
