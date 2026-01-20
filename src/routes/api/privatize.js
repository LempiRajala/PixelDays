/*
 *
 * block all private messages
 *
 */
import logger from '../../core/logger.js';
import { setFlagOfUser } from '../../data/sql/User.js';
import { USER_FLAGS } from '../../core/constants.ts';

async function privatize(req, res) {
  const { priv } = req.body;
  const { user } = req;

  if (typeof priv !== 'boolean') {
    res.status(400).json({
      errors: ['Not defined if setting or unsetting private'],
    });
    return;
  }

  logger.info(`User ${user.name} set private status to ${priv}`);

  await setFlagOfUser(user.id, USER_FLAGS.PRIV, priv);

  res.json({
    status: 'ok',
  });
}

export default privatize;
