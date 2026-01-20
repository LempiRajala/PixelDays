/*
 *
 * block all private messages
 *
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { setFlagOfUser } from '../../data/sql/User.js';
import { deleteAllDMChannelsOfUser } from '../../data/sql/Channel.js';
import { USER_FLAGS } from '../../core/constants.ts';

async function blockdm(req, res) {
  const { block } = req.body;
  const { user } = req;

  if (typeof block !== 'boolean') {
    res.status(400).json({
      errors: ['Not defined if blocking or unblocking'],
    });
    return;
  }

  logger.info(`User ${user.name} (un)blocked all dms`);

  await setFlagOfUser(user.id, USER_FLAGS.BLOCK_DM, block);

  if (block) {
    const dmChannels = await deleteAllDMChannelsOfUser(user.id);
    if (dmChannels.length) {
      dmChannels.forEach(({ cid, dmuid }) => {
        socketEvents.broadcastRemoveChatChannel(user.id, cid);
        socketEvents.broadcastRemoveChatChannel(dmuid, cid);
      });
    }
  }

  res.json({
    status: 'ok',
  });
}

export default blockdm;
