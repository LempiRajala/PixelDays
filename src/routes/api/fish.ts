/*
 * get information of fish
 */
import type { Handler } from 'express';
import { getFishById } from '../../data/sql/Fish.js';
import { resolveSessionUidOfRequest } from '../../middleware/session.js';

const fish: Handler = async (req, res) => {
  req.tickRateLimiter(1000);

  res.set({
    'Cache-Control': 'public, s-maxage=180, max-age=280',
  });

  const { body: { id }, ttag: { t } } = req;
  if (typeof id !== 'number') {
    throw new Error(t`No or invalid fish id.`);
  }
  const fishData = await getFishById(id);
  if (!fishData) {
    throw new Error(t`No such fish found`);
  }
  if (fishData.isPrivate) {
    const uid = await resolveSessionUidOfRequest(req);
    if (uid !== fishData.caughtByUid) {
      throw new Error(t`The user owning this fish is private`);
    }
  }

  delete fishData.isPrivate;
  res.status(200).json(fishData);
}

export default fish;