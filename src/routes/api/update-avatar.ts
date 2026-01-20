import { minioService } from '../../data/minio-service';
import { createFile, deleteFile } from '../../db/utils/files';
import type { Request, Response } from 'express';
import type { User } from '../../middleware/session.js';
import { updateUser } from '../../db/utils/users.ts';
import { User as DbUser } from '@/db/schema.ts';
import { changeFilenameExtension, compressAndResizeImage } from '../../core/server-utils.ts';
import { avatarSizeAfterUploading } from '../../core/constants.ts';
import { UsersAvatarsCache } from './users-avatars-cache.ts';
import { TaskQueue } from './task-queue.ts';
import ChatProvider from '../../core/ChatProvider.js';
import socketEvents from '../../socket/socketEvents.js';

const compressorQueue = new TaskQueue((buffer: Buffer) => {
  return compressAndResizeImage({
    buffer: buffer,
    width: avatarSizeAfterUploading,
    height: avatarSizeAfterUploading,
  })
});

export default async (req: Request, res: Response) => {
  //@ts-expect-error
  req.tickRateLimiter(3000);

  if(compressorQueue.length > 20) {
    return res.status(429).send('server overloaded');
  }

  const user = (req as unknown as { user: User }).user;
  let resultAvatarId: string | null;
  const file = req.file;
  if (file) {
    const newFilename = changeFilenameExtension(file.originalname, 'webp');
    const newMimetype = 'image/webp';
    const dbFile = await createFile({
      filename: newFilename,
      mimetype: newMimetype,
    });
    try {
      const handledFile = await compressorQueue.add(file.buffer);
      await minioService.writeObject(dbFile.id, {
        name: newFilename,
        type: newMimetype,
        size: handledFile.byteLength,
        buffer: handledFile,
      });
    } catch(e) {
      console.error(e);
      await deleteFile(dbFile.id);
      return res.status(500);
    }
  
    await updateUser(user.id, {
      avatarId: dbFile.id,
    });
    resultAvatarId = dbFile.id;
  } else {
    await updateUser(user.id, {
      avatarId: null,
    });
    resultAvatarId = null;
  }

  if(UsersAvatarsCache.has(user.id)) {
    UsersAvatarsCache.set(user.id, resultAvatarId);
  }

  ChatProvider.chatMessageBuffer.hasMessageFromUser({
    userId: user.id,
    checkOnlyCached: true,
  }).then(hasUserMessagesInBuffer => {
    if(!hasUserMessagesInBuffer) return;
    socketEvents.emit('userAvatarUpdated', user.id, resultAvatarId);
  }).catch(e => console.error(e));

  return res
    .status(200)
    .send({ avatarId: resultAvatarId } satisfies Pick<DbUser, 'avatarId'>);
};