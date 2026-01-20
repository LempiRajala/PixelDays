/*
 * middlewares and functions for OpenID Connect Routes
 */

import { resolveSessionUidAndAgeOfRequest } from './session.js';
import { getOIDCClient } from '../data/sql/OIDCClient.js';
import { createJWT, hashValue } from '../core/jwt.js';
import { generatePPID } from '../utils/hash.js';
import { getUserOIDCProfile } from '../data/sql/User.js';
import { getAccessToken } from '../data/sql/OIDCAccessToken.js';

import { OIDC_URL } from '../core/config.js';
import { USERLVL } from '../core/constants.ts';

/**
 * generate openid id_token for user
 * @param uid userId
 * @param clientId the uuid of the client
 * @param scopes
 * @param responsePayload payload we already have for whatever response we make,
 *   used to avoid double-fetching stuff
 * @param authAge session age in seconds
 * @param nonce nonce | null
 */
export async function generateIdToken(
  uid, clientId, scope, responsePayload, authAge, nonce,
) {
  const currentTsS = Math.floor(Date.now() / 1000);
  const payload = {
    /* oidc provider url */
    iss: OIDC_URL,
    /* unique user identifier */
    sub: generatePPID(clientId, String(uid)),
    /* audience aka client_id */
    aud: clientId,
    /* expiration, one hour, same as access token */
    exp: currentTsS + 3600,
    /* date of issuence */
    iat: currentTsS,
  };
  if (nonce) {
    payload.nonce = nonce;
  }
  if (authAge) {
    payload.auth_time = authAge;
  }
  if (responsePayload.access_token) {
    /*
     * only relevant for response_type=id_token token
     */
    payload.at_hash = hashValue(responsePayload.access_token);
  }
  if (responsePayload.code) {
    /*
     * only relevant for response_type=code id_token
     */
    payload.c_hash = hashValue(responsePayload.code);
  }

  /*
   * id_token will be populated with openid, profile and email related data,
   * other scopes shall be handled on ./userinfo
   */

  let userProfileModel;

  if (scope.includes('user_id')) {
    let userlvl = responsePayload.user_lvl;
    if (!userlvl) {
      userProfileModel = await getUserOIDCProfile(uid);
      if (!userProfileModel) {
        return null;
      }
      userlvl = userProfileModel.userlvl;
    }
    payload.user_lvl = userlvl;
    payload.verified = userlvl >= USERLVL.VERIFIED;
    payload.user_id = String(uid);
  }

  if (scope.includes('profile')) {
    let {
      name, preferred_username: username, updated_at: createdAt,
    } = responsePayload;
    if (!name || !username || !createdAt) {
      if (!userProfileModel) {
        userProfileModel = await getUserOIDCProfile(uid);
        if (!userProfileModel) {
          return null;
        }
      }
      ({ name, username } = userProfileModel);
      createdAt = Math.floor(userProfileModel.createdAt.getTime() / 1000);
    }
    payload.name = name;
    payload.preferred_username = username;
    payload.updated_at = createdAt;
  }

  if (scope.includes('email')) {
    let { email, email_verified: verified } = responsePayload;
    if (!email || (!verified && verified !== false)) {
      if (!userProfileModel) {
        userProfileModel = await getUserOIDCProfile(uid);
        if (!userProfileModel) {
          return null;
        }
      }
      ({ email, verified } = userProfileModel);
    }
    payload.email = email;
    payload.email_verified = verified === 1;
  }

  return createJWT(payload);
}

/**
 * generator for middleware to verify and ensure oauth / oidc authorization
 * sets oidcUserId oidcScope oidcClientId on req
 * @param requiredScope the required oauth scope or null if any goes
 */
export const requireOidc = (
  requiredScope = null, allowUnauthenticated = false,
) => async (req, res, next) => {
  let uid;
  let scope;
  let clientId;
  try {
    let { authorization } = req.headers;
    if (!authorization) {
      if (allowUnauthenticated) {
        next();
        return;
      }
      throw new Error('Authorization header required');
    }
    authorization = authorization.trim();
    if (!authorization.startsWith('Bearer')) {
      throw new Error('Invalid Authorization method');
    }
    authorization = authorization.substring(7).trim();
    const tokenModel = await getAccessToken(authorization);
    if (!tokenModel) {
      throw new Error('Invalid access token');
    }
    ({ uid, scope, clientId } = tokenModel);
    if (!scope.length
      || (requiredScope && !scope.includes(requiredScope))
    ) {
      const err = new Error('Invalid scope of token');
      err.title = 'insufficient_scope';
      throw err;
    }
  } catch (err) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      Expires: '0',
    });
    res.set({
      // eslint-disable-next-line max-len
      'WWW-Authenticate': `Bearer error="${err.title || 'invalid_request'}", error_description="${err.message}"`,
    });
    res.status(err.status || 401).send();
    return;
  }
  req.oidcUserId = uid;
  req.oidcScope = scope;
  req.oidcClientId = clientId;
  next();
};

/*
 * both authorization request and the client consent request, send the same
 * data and it shall be validated the same in both
 * sets lots of stuff on req
 */
export const validateAuthRequest = async (req, res, next) => {
  req.tickRateLimiter(5000);

  const { t } = req.ttag;
  let redirectUri;

  try {
    /*
     * minimum: {
     *  response_type,
     *  client_id,
     *  redirect_url,
     *  scope,
     * }
     * optional: {
     *   code_challenge: PKCE challenge to verify same client requests token
     *     that also requested the whole flow,
     *   code_challenge_method,
     *   state: state to pass around against CSRF,
     *   nonce: only used for id_tokens to avoid replay attacks, we don't use
     *     id_tokens, so we ignore that
     *   max_age: allowed age in second since last user authentification
     *     (allowed session age)
     *   prompt: 'none', 'login', 'consent', 'select_account'
     * }
     */
    const params = (req.method === 'GET') ? req.query : req.body;
    const {
      response_type: responseType,
      client_id: clientId,
      code_challenge: codeChallenge,
    } = params;
    let {
      scope,
      code_challenge_method: codeChallengeMethod,
    } = params;
    ({ redirect_uri: redirectUri } = params);

    if (responseType !== 'code') {
      throw new Error(
        t`This application uses a login method we do not support`,
      );
    }
    if (!clientId) {
      throw new Error(t`This application is not allowed to login`);
    }
    /* according to specs, method defaults to 'plain' */
    if (codeChallenge && !codeChallengeMethod) {
      codeChallengeMethod = 'plain';
    }
    if (codeChallengeMethod
      && codeChallengeMethod !== 'plain' && codeChallengeMethod !== 'S256'
    ) {
      throw new Error(
        t`This application uses a PKCE method we do not support`,
      );
    }
    /* limit nonce length */
    if (params.nonce?.length > 255) {
      throw new Error('Nonce parameter too long, max length: 255');
    }

    const [[uid, sessionAge, userIsValid], clientModel] = await Promise.all([
      resolveSessionUidAndAgeOfRequest(req),
      getOIDCClient(clientId),
    ]);
    if (!clientModel) {
      const error = new Error(t`This application is not allowed to login`);
      error.title = 'invalid_client';
      error.status = 401;
      throw error;
    }
    /*
     * according to specs, if no redirect_uri is given and there is only one, we
     * must use it
     */
    if (!redirectUri) {
      if (clientModel.redirectUris.length === 1) {
        [redirectUri] = clientModel.redirectUris;
      } else {
        throw new Error(
          t`This application sent a faulty login request with no redirection`,
        );
      }
    } else if (!clientModel.redirectUris.includes(redirectUri)) {
      redirectUri = null;
      throw new Error(t`This application redirects to an unallowed page`);
    }
    /*
     * check if redirectUri is at a local ip to treat it differently
     */
    let redirectIsLocal = false;
    if (redirectUri.includes('://localhost')
      || redirectUri.includes('://127.0') || redirectUri.includes('://192.168')
    ) {
      redirectIsLocal = true;
    }
    /*
     * according to specs, we can do whatever we want if no scope is given, we
     * let the client choose the default and if not, use empty
     * NOTE that an empty scope is not openid, since openid requires the openid
     * scope
     */
    if (!scope) {
      scope = clientModel.defaultScope || [];
    } else if (!Array.isArray(scope)) {
      scope = scope.toLowerCase().split(' ');
    }
    /*
     * remove duplicates and unallowed scopes
     */
    scope = scope.sort().filter((s, pos, self) => {
      if (!clientModel.scope.includes(s)) {
        return false;
      }
      return pos === 0 || s !== self[pos - 1];
    });
    /*
     * overwrite values that might have changed
     */
    params.scope = scope;
    params.redirect_uri = redirectUri;
    params.code_challenge_method = codeChallengeMethod;
    req.oidcUserId = uid;
    req.oidcClientModel = clientModel;
    req.oidcAuthTime = sessionAge;
    req.oidcRedirectIsLocal = redirectIsLocal;
    req.oidcUserValid = userIsValid;
    req.oidcNeedReauth = Number(params.max_age) < sessionAge
    || params.prompt === 'login';
    /* overwriting req.query does not work, so send it extra */
    req.oidcParams = params;
    next();
  } catch (error) {
    if (!error.title) {
      error.title = 'invalid_request';
    }
    error.redirectUri = redirectUri;
    throw error;
  }
};
