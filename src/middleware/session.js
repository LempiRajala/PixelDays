/*
 * express middlewares for handling user sessions
 */
import { parse as parseCookie } from 'cookie';
import { HOUR, USER_FLAGS } from '../core/constants.ts';
import { TIMEBLOCK_USERS } from '../core/config.js';
import {
  resolveSession, createSession, removeSession, resolveSessionUid,
  resolveSessionUidAndAge,
} from '../data/sql/Session.js';
import { parseListOfBans } from '../data/sql/Ban.js';
import { touchUser } from '../data/sql/User.js';
import { sign, unsign } from '../utils/hash.js';


export class User {
  id;
  userlvl;
  /*
   * {
   *   id,
   *   name,
   *   password,
   *   userlvl,
   *   flags,
   *   lastSeen,
   *   createdAt,
   *   havePassword,
   *   bans: [ { expires, flags }, ... ],
   *   tpids: [ { tpid, provider }, ... ],
   *   blocked: [ { id, name }, ...],
   *   channels: {
   *     cid: [ name, type, lastTs, [dmuid] ],
   *     ...
   *   },
   * }
   */
  #data;
  /* session token */
  #token;
  /* null | boolean */
  isBanned = null;
  /* null | boolean */
  isMuted = null;
  /*
   * Blocked users can not see the canvas during defined daytimes, but see a
   * message instead and can interact with chat
   * null | string HHmm-HHmm
   */
  blockedInterval = null;
  /*
   * timestamp when ban should be rechecked,
   * null means to never recheck (so if not banned or perma banned)
   */
  banRecheckTs = null;

  constructor(data, token) {
    this.id = data.id;
    this.userlvl = data.userlvl;
    this.#token = token;
    this.#data = data;
    const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
    this.isBanned = isBanned;
    this.isMuted = isMuted;
    this.banRecheckTs = banRecheckTs;
    if (TIMEBLOCK_USERS) {
      const timeBlockProps = TIMEBLOCK_USERS.get(this.id);
      if (timeBlockProps) {
        [this.blockedInterval] = timeBlockProps;
      }
    }
  }

  static mailProvider;

  static setMailProvider(mailProvider) {
    User.mailProvider = mailProvider;
  }

  get data() {
    return this.#data;
  }

  get name() {
    return this.#data.name;
  }

  get token() {
    return this.#token;
  }

  get isPrivate() {
    return (this.#data.flags & (0x01 << USER_FLAGS.PRIV)) !== 0;
  }

  touch(ipString) {
    if (this.#data.lastSeen.getTime() > Date.now() - 10 * 60 * 1000) {
      return false;
    }
    return touchUser(this.id, ipString);
  }

  hasChannel(cid) {
    return !!this.#data.channels[cid];
  }

  getChannel(cid) {
    return this.#data.channels[cid];
  }

  removeChannel(cid) {
    delete this.#data.channels[cid];
  }

  addChannel(cid, channelArray) {
    this.#data.channels[cid] = channelArray;
  }

  refresh() {
    return this.getAllowance(true);
  }

  /**
   * fetch allowance data of user
   * @param refresh whether we should refetch it, weven if we have it already
   * @return { isBanned, isMuted }
   */
  async getAllowance(refresh = false) {
    if (refresh
      || (this.banRecheckTs !== null && this.banRecheckTs < Date.now())
    ) {
      const data = await resolveSession(this.#token);
      if (data) {
        this.userlvl = data.userlvl;
        this.#data = data;
        const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
        this.isBanned = isBanned;
        this.isMuted = isMuted;
        this.banRecheckTs = banRecheckTs;
      } else {
        return {
          isBanned: this.isBanned, isMuted: this.isMuted, loggedOut: true,
        };
      }
    }
    return { isBanned: this.isBanned, isMuted: this.isMuted };
  }
}

/**
 * resolve session of request by session cookie and add user object if possible
 * @param req express request
 */
async function resolveSessionOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
  } else {
    req.user = new User(userData, token);
  }
}

/**
 * resolve only user id of session if possible
 * @param req express request
 * @return uid
 */
export async function resolveSessionUidOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  return resolveSessionUid(token);
}

/**
 * resolve age of session
 * @param req express request
 * @return [uid, age in seconds, boolean if user is valid for oauth]
 */
export async function resolveSessionUidAndAgeOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  return resolveSessionUidAndAge(token);
}

/*
 * express middleware to parse session cookie and add user,
 * if session can not be verified, continue without setting user
 */
export async function verifySession(req, res, next) {
  await resolveSessionOfRequest(req);
  next();
}

/*
 * express middleware to verify session in a promise under req.promise,
 * Promise can be resolved by './promises.js' middleware.
 * This has the purpose to allow other actions to happen while we wait for SQL.
 */
export async function verifySessionPromisified(req, res, next) {
  if (!req.promise) {
    req.promise = [];
  }
  req.promise.push(resolveSessionOfRequest(req));
  next();
}

/*
 * express middleware that cancels if not logged in
 */
export function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    let errorMessage;
    if (req.ttag) {
      const { t } = req.ttag;
      errorMessage = t`You are not logged in`;
    } else {
      errorMessage = 'You are not logged in';
    }
    const error = new Error(errorMessage);
    error.status = 401;
    next(error);
  }
  next();
}

/**
 * Open a new session, set cookie and store it, NOT a middleware
 * @param req express request object
 * @param res express response object
 * @param userId user id
 * @param durationHours how long session is valid in hours or null for permanent
 * @param noCookie skip setting cookies, in case we are only interested in
 *   the token
 * @return token | null
 */
export async function openSession(
  req, res, userId, durationHours = 720, noCookie = false,
) {
  const { ip, lang } = req;
  let domain = ip.getHost(false, true);
  const portSeperator = domain.lastIndexOf(':');
  if (portSeperator !== -1) {
    domain = domain.substring(0, portSeperator);
  }

  const [token, newLocation] = await createSession(
    userId, durationHours, ip, req.device,
  );
  if (!token) {
    return null;
  }

  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
    return null;
  }
  req.user = new User(userData, token);

  req.user.touch(ip.ipString);
  if (newLocation) {
    User.mailProvider?.sendNewLocationMail(
      req.user.id, req.ip.getHost(), lang, ip.ipString,
    );
  }

  const cookieOptions = { domain, httpOnly: true, secure: false };

  if (!noCookie) {
    if (durationHours === null) {
      /* a permanent cookie is just a cookie that expires really late */
      durationHours = 24 * 365 * 15;
    }
    /*
    * if durationHours is 0, we don't set expire, which makes it expire on
    * closing the browser
    */
    if (durationHours) {
      cookieOptions.expires = new Date(Date.now() + durationHours * HOUR);
    }
    res.cookie('ppfun.session', sign(token), cookieOptions);
  }
  return token;
}

export function clearCookie(req, res) {
  let domain = req.ip.getHost(false, true);
  const portSeperator = domain.lastIndexOf(':');
  if (portSeperator !== -1) {
    domain = domain.substring(0, portSeperator);
  }

  res.clearCookie('ppfun.session', {
    domain, httpOnly: true, secure: false,
  });
}

/**
 * Close a session and remove cookie, NOT a middleware
 * @param req express request object
 * @param res express response object
 * @return boolean if successful
 */
export async function closeSession(req, res) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = unsign(cookies['ppfun.session']);
  const success = await removeSession(token);
  clearCookie(req, res);
  delete req.user;
  return success;
}
