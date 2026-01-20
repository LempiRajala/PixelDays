import express from 'express';

import { verifySession, ensureLoggedIn } from '../../middleware/session.js';
import { parseDevice } from '../../middleware/device.js';
import errorJson from '../../middleware/errorJson.js';

import me from './me.js';
import auth from './auth/index.js';
import chatHistory from './chathistory.js';
import startDm from './startdm.js';
import leaveChan from './leavechan.js';
import block from './block.js';
import blockdm from './blockdm.js';
import privatize from './privatize.js';
import modtools from './modtools.js';
import baninfo from './baninfo.js';
import getiid from './getiid.js';
import shards from './shards.js';
import profile from './profile.js';
import canvases from './canvases.js';
import fish from './fish.js';
import badge from './badge.js';
import banme from './banme.js';
import updateAvatar from './update-avatar.ts';
import updateBanner from './update-banner.ts';

import { multerUpload } from '../multer.ts';
// import media from './media.js';

const router = express.Router();

router.use('/canvases', canvases);

router.use(express.json());

router.post('/fish', fish);

router.post('/badge', badge);

/*
 * set cache control and reject disallowed cors
 */
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });

  if (req.csrfPossible) {
    const error = new Error('Request from this origin denied.');
    error.status = 403;
    throw error;
  }

  next();
});

// routes that don't need a user
router.get('/shards', shards);

router.get('/getiid', getiid);

/*
 * get user session if available
 */
router.use(verifySession);

router.get('/chathistory', chatHistory);

router.get('/baninfo', baninfo);

router.post('/lanme', banme);

// router.use('/media', media);

router.use((req, res, next) => {
  req.tickRateLimiter(3000);
  next();
});

router.get('/me', me);

router.use(parseDevice);

router.use('/auth', auth);

router.use('/modtools', modtools);

/*
 * only with session
 */
router.use(ensureLoggedIn);
router
  .get('/profile', profile)
  .post('/startdm', startDm)
  .post('/leavechan', leaveChan)
  .post('/block', block)
  .post('/blockdm', blockdm)
  .post('/privatize', privatize)
  .post('/update-avatar', multerUpload.single('file'), updateAvatar)
  .post('/update-banner', multerUpload.single('file'), updateBanner);

router.use(errorJson);

export default router;
