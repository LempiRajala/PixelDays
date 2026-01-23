import { minioService } from '../../data/minio-service';
import { createFile, deleteFile } from '../../db/utils/files';
import type { Request, Response } from 'express';
import type { User } from '../../middleware/session.js';
import { updateUser } from '../../db/utils/users.ts';
import { User as DbUser } from '../../db/schema.ts';
import { changeFilenameExtension, compressImage, defaultWebpCompressionOptions } from '../../core/server-utils.ts';
import { TaskQueue } from './task-queue.ts';

const compressorQueue = new TaskQueue(buffer => {
  return compressImage({
    buffer,
    options: {
      ...defaultWebpCompressionOptions,
      quality: 95,
    }
  });
});

export default async (req: Request, res: Response) => {
  //@ts-expect-error
  req.tickRateLimiter(3000);

  if(compressorQueue.length > 20) {
    return res.status(429).send('server overloaded');
  }

  const user = (req as unknown as { user: User }).user;
  let resultBannerId: string | null;
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
      bannerId: dbFile.id,
    });
    resultBannerId = dbFile.id;
  } else {
    await updateUser(user.id, {
      bannerId: null,
    });
    resultBannerId = null;
  }

  return res
    .status(200)
    .send({ bannerId: resultBannerId } satisfies Pick<DbUser, 'bannerId'>);
};