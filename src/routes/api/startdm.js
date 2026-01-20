/*
 *
 * starts a DM session
 *
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import {
  isUserBlockedBy,
} from '../../data/sql/association_models/UserBlock.js';
import { findUserByIdOrName } from '../../data/sql/User.js';
import { createDMChannel } from '../../data/sql/Channel.js';
import { USER_FLAGS } from '../../core/constants.ts';

async function startDm(req, res) {
  let userId = parseInt(req.body.userId, 10);
  let { userName } = req.body;
  const { user } = req;

  const errors = [];
  if (userId) {
    if (userId && Number.isNaN(userId)) {
      errors.push('Invalid userId');
    }
  }
  if (!userName && !userId) {
    errors.push('No userId or userName defined');
  }
  if (userId && user.id === userId) {
    errors.push('You can not  DM yourself.');
  }
  if (errors.length) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const targetUser = await findUserByIdOrName(userId, userName);
  if (!targetUser) {
    res.status(401);
    res.json({
      errors: ['Target user does not exist'],
    });
    return;
  }
  userId = targetUser.id;
  userName = targetUser.name;

  if (targetUser.flags & (0x01 << USER_FLAGS.BLOCK_DM)) {
    res.status(401);
    res.json({
      errors: [`${userName} doesn't allow DMs`],
    });
    return;
  }

  if (await isUserBlockedBy(userId, user.id)) {
    res.status(401);
    res.json({
      errors: [`${userName} has blocked you.`],
    });
    return;
  }

  logger.info(
    `Creating DM Channel between ${user.name} and ${userName}`,
  );

  const [channelId] = await createDMChannel(user.id, userId);

  if (channelId) {
    const curTime = Date.now();
    socketEvents.broadcastAddChatChannel(
      user.id,
      channelId,
      [userName, 1, curTime, userId],
    );
    socketEvents.broadcastAddChatChannel(
      userId,
      channelId,
      [user.name, 1, curTime, user.id],
    );
  } else {
    throw new Error(`Couldn't create a DM with ${userName}, try again later.`);
  }

  res.json({
    channel: {
      [channelId]: [
        userName,
        1,
        Date.now(),
        userId,
      ],
    },
  });
}

export default startDm;
