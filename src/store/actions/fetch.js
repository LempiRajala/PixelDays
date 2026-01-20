/*
 * Collect api fetch commands for actions here
 * (chunk and tiles requests in ui/ChunkLoader*.js)
 *
 */

import { t } from 'ttag';

import { dateToString, stringToTime } from '../../core/utils.js';
import { api } from '../../utils/utag.js';

/*
 * Adds customizable timeout to fetch
 * defaults to 8s
 */
export async function fetchWithTimeout(url, options = {}) {
  const { timeout = 30000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  return response;
}

/*
 * Parse response from API
 * @param response
 * @return Object of response
 */
async function parseAPIresponse(response) {
  const { status: code } = response;

  if (code === 429) {
    let error = t`You made too many requests`;
    const retryAfter = response.headers.get('Retry-After');
    if (!Number.isNaN(Number(retryAfter))) {
      const ti = Math.floor(retryAfter / 60);
      error += `, ${t`try again after ${ti}min`}`;
    }
    return {
      errors: [error],
    };
  }

  try {
    return await response.json();
  } catch (e) {
    return {
      errors: [t`Connection error ${code} :(`],
    };
  }
}

/*
 * Make API POST Request
 * @param url URL of post api endpoint
 * @param body Body of request
 * @return Object with response or error Array
 */
async function makeAPIPOSTRequest(
  url,
  body,
  credentials = true,
  addShard = true,
) {
  if (addShard) {
    url = api`${url}`;
  }
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      credentials: (credentials) ? 'include' : 'omit',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return parseAPIresponse(response);
  } catch (e) {
    return {
      errors: [t`Could not connect to server, please try again later :(`],
    };
  }
}

/*
 * Make API GET Request
 * @param url URL of get api endpoint
 * @return Object with response or error Array
 */
async function makeAPIGETRequest(
  url,
  credentials = true,
  addShard = true,
) {
  if (addShard) {
    url = api`${url}`;
  }
  try {
    const response = await fetchWithTimeout(url, {
      credentials: (credentials) ? 'include' : 'omit',
    });

    return parseAPIresponse(response);
  } catch (e) {
    return {
      errors: [t`Could not connect to server, please try again later :(`],
    };
  }
}

/*
 * block / unblock user
 * @param userId id of user to block
 * @param block true if block, false if unblock
 * @return error string or null if successful
 */
export async function requestBlock(userId, block) {
  const res = await makeAPIPOSTRequest(
    '/api/block',
    { userId, block },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * set / unset profile as private
 * @param priv
 * @return error string or null if successful
 */
export async function requestPrivatize(priv) {
  const res = await makeAPIPOSTRequest(
    '/api/privatize',
    { priv },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * start new DM channel with user
 * @param query Object with either userId or userName: string
 * @return channel Array on success, error string if not
 */
export async function requestStartDm(query) {
  const res = await makeAPIPOSTRequest(
    '/api/startdm',
    query,
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.channel) {
    return res.channel;
  }
  return t`Unknown Error`;
}

/*
 * set receiving of all DMs on/off
 * @param block true if blocking all dms, false if unblocking
 * @return error string or null if successful
 */
export async function requestBlockDm(block) {
  const res = await makeAPIPOSTRequest(
    '/api/blockdm',
    { block },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * leaving Chat Channel (i.e. DM channel)
 * @param channelId integer id of channel
 * @return error string or null if successful
 */
export async function requestLeaveChan(channelId) {
  const res = await makeAPIPOSTRequest(
    '/api/leavechan',
    { channelId },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

export async function requestSolveCaptcha(text, captchaid) {
  const res = await makeAPIPOSTRequest(
    '/api/captcha',
    { text, id: captchaid },
  );
  if (!res.errors && !res.success) {
    return {
      errors: [t`Server answered with gibberish :(`],
    };
  }
  return res;
}

export async function requestHistoricalTimes(day, canvasId) {
  try {
    const date = dateToString(day);
    // Not going over shard url
    const url = api`/history?day=${date}&id=${canvasId}`;
    const response = await fetchWithTimeout(url, {
      credentials: 'omit',
      timeout: 45000,
    });
    if (response.status !== 200) {
      return [];
    }
    const times = await response.json();
    return times.map(stringToTime);
  } catch {
    return [];
  }
}

export async function requestChatMessages(cid) {
  const response = await fetch(
    api`/api/chathistory?cid=${cid}&limit=50`,
    { credentials: 'include' },
  );
  // timeout in order to not spam api requests and get rate limited
  if (response.ok) {
    return await response.json();
  }
  return null;
}

export function requestPasswordChange(newPassword, password) {
  return makeAPIPOSTRequest(
    '/api/auth/change_passwd',
    { password, newPassword },
  );
}

export async function requestResendVerify() {
  return makeAPIGETRequest(
    '/api/auth/resend_verify',
  );
}

export async function requestLogOut() {
  const ret = await makeAPIGETRequest(
    '/api/auth/logout',
  );
  return !ret.errors;
}

export async function requestConsent(params) {
  return makeAPIPOSTRequest('/oidc/consent', params);
}

export function requestNameChange(name) {
  return makeAPIPOSTRequest(
    '/api/auth/change_name',
    { name },
  );
}

export function requestUsernameChange(username, token) {
  const data = { username };
  if (token) {
    data.token = token;
  }
  return makeAPIPOSTRequest('/api/auth/change_username', data);
}

export function requestMailChange(email, password) {
  return makeAPIPOSTRequest(
    '/api/auth/change_mail',
    { email, password },
  );
}

export function requestLogin(
  nameoremail, password, durationsel, returnToken,
) {
  const data = { nameoremail, password, durationsel };
  if (returnToken) {
    data.returnToken = true;
  }
  return makeAPIPOSTRequest('/api/auth/local', data);
}

export function requestRegistration(
  name, username, email, password, durationsel,
  captcha, captchaid, challengeSolution,
) {
  const body = {
    name, username, email, password, durationsel,
    captcha, captchaid,
  };
  if (challengeSolution) {
    body.cs = challengeSolution;
  }
  return makeAPIPOSTRequest('/api/auth/register', body);
}

export function requestNewPassword(email) {
  return makeAPIPOSTRequest(
    '/api/auth/restore_password',
    { email },
  );
}

export function requestDeleteAccount(password) {
  return makeAPIPOSTRequest(
    '/api/auth/delete_account',
    { password },
  );
}

export function requestRemoveTpid(id, password) {
  return makeAPIPOSTRequest(
    '/api/auth/remove_tpid',
    { id, password },
  );
}

export function requestCloseSession(id, password) {
  return makeAPIPOSTRequest(
    '/api/auth/close_session',
    { id, password },
  );
}

export function requestRemoveConsent(id) {
  return makeAPIPOSTRequest('/api/auth/revoke_consent', { id });
}

export function requestRankings() {
  return makeAPIGETRequest(
    '/ranking',
    false,
  );
}

export function requestProfile() {
  return makeAPIGETRequest(
    '/api/profile',
  );
}

export function requestFish(id) {
  return makeAPIPOSTRequest(
    '/api/fish',
    { id },
  );
}

export function requestBadge(id) {
  return makeAPIPOSTRequest(
    '/api/badge',
    { id },
  );
}
export function requestTpids() {
  return makeAPIGETRequest(
    '/api/auth/get_tpids',
  );
}

export function requestBanInfo() {
  return makeAPIGETRequest(
    '/api/baninfo',
  );
}

export async function requestMe() {
  if (window.me) {
    // api/me gets pre-fetched by embedded script in html
    const response = await window.me;
    delete window.me;
    return parseAPIresponse(response);
  }
  return makeAPIGETRequest(
    '/api/me',
  );
}

export function requestIID() {
  return makeAPIGETRequest(
    '/api/getiid',
  );
}

let alreadyRequested = false;
export function requestBanMe(code) {
  if (alreadyRequested) {
    return null;
  }
  alreadyRequested = true;
  return makeAPIPOSTRequest(
    '/api/lanme',
    { code },
  );
}
