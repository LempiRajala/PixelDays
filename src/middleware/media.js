/*
 * middleware and related functions for media upload
 */
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

import { getRandomString } from '../core/utils.js';
import {
  registerMedia, deregisterMedia, hasMedia,
} from '../data/sql/Media.js';
import { MAX_MEDIA_SIZE } from '../core/constants.ts';
import { MEDIA_FOLDER } from '../core/config.js';

const typeToExt = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpeg', 'jpg'],
  'image/png': 'png',
  'image/jxl': 'jxl',
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

const queue = [];
let isStripping = false;
let exiftoolProcess;
let responseBuffer = '';

function spawnExiftool(resultCallback) {
  console.log('spawn exiftool');
  exiftoolProcess = spawn('exiftool', [
    '-stay_open', 'True', '-@', '-',
  ], {
    shell: process.platform === 'win32',
  });

  const cleanUp = () => {
    if (exiftoolProcess) {
      exiftoolProcess.stdin.destroy();
      exiftoolProcess.stdout.destroy();
      exiftoolProcess = null;
    }
    for (let i = 0; i < queue.length; i += 1) {
      queue[i][1]();
    }
    queue.length = 0;
    responseBuffer = '';
    isStripping = false;
  };

  exiftoolProcess.on('close', cleanUp);
  exiftoolProcess.on('error', cleanUp);

  exiftoolProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    if (responseBuffer.includes('{ready}')) {
      const responses = responseBuffer.split('{ready}');

      for (let i = 0; i < responses.length - 1; i++) {
        const response = responses[i].trim();
        /*
         * errors is also on stdout
         */
        if (response && queue.length > 0) {
          const [filename, callback] = queue.shift();
          if (response.toLowerCase().includes('error')) {
            console.error(
              `MEDIA: EXIF stripping failed for ${filename}: ${response}`,
            );
          }
          callback();
        }
      }

      responseBuffer = responses[responses.length - 1] || '';
      setTimeout(resultCallback, 10);
    }
  });
}

export function killExiftool() {
  console.log('End exiftool child process');
  return new Promise((resolve) => {
    if (exiftoolProcess && !exiftoolProcess.killed) {
      exiftoolProcess.stdin.write('-stay_open\nFalse\n-execute\n');
      setTimeout(() => {
        if (exiftoolProcess && !exiftoolProcess.killed) {
          exiftoolProcess.kill('SIGTERM');
        }
        resolve();
      }, 1000);
    }
  });
}

function stripExifFromQueue() {
  if (!queue.length) {
    isStripping = false;
    return;
  }
  isStripping = true;
  if (!exiftoolProcess) {
    spawnExiftool(stripExifFromQueue);
  }
  const command = `${queue[0][0]}\n-all=\n-overwrite_original\n-execute\n`;

  exiftoolProcess.stdin.write(command, (error) => {
    if (error) {
      queue.shift()[1]();
      stripExifFromQueue();
    }
  });
}

export function stripExif(filename) {
  return new Promise((resolve) => {
    queue.push([filename, resolve]);
    if (!isStripping) {
      stripExifFromQueue();
    }
  });
}

export function calculateHash(filepath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filepath);
    const cryptHash = createHash('sha256');

    readStream.on('data', (chunk) => {
      cryptHash.update(chunk);
    });
    readStream.on('end', () => {
      resolve(cryptHash.digest('hex'));
    });
    readStream.on('error', (error) => {
      reject(error);
    });
  });
}

export async function createImageThumbnails(filePath) {
  try {
    const { dir, name, ext } = path.parse(filePath);
    let thumbFilePath = path.join(dir, `${name}_${ext.substring(1)}`);
    const iconFilePath = `${thumbFilePath}_icon.webp`;
    thumbFilePath += '_thumb.webp';

    const previewBuffer = await sharp(filePath).resize(320, 240, {
      fit: 'inside',
      withoutEnlargement: true,
    }).webp({
      quality: 80,
      effort: 4,
    }).toBuffer();

    await Promise.all([
      fs.promises.writeFile(thumbFilePath, previewBuffer),
      sharp(previewBuffer).resize(48, 48, {
        fit: 'cover',
        position: 'center',
      }).webp({ quality: 75 }).toFile(iconFilePath),
    ]);
  } catch (error) {
    console.error(
      `MEDIA: Could not create thumbnails for ${filePath} ${error.message}`,
    );
    throw error;
  }
}

export async function createVideoThumbnails(filePath) {
  try {
    const { dir, name, ext } = path.parse(filePath);
    let thumbFilePath = path.join(dir, `${name}_${ext.substring(1)}`);
    const iconFilePath = `${thumbFilePath}_icon.webp`;
    thumbFilePath += '_thumb.webp';

    await new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', filePath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=320:240:force_original_aspect_ratio=decrease',
        '-qscale:v', 80,
        '-compression_level', '6',
        '-y',
        thumbFilePath,
      ]);

      let stderr = '';
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          return;
        }
        resolve();
      });

      ffmpegProcess.on('error', reject);
    });

    await sharp(thumbFilePath).resize(48, 48, {
      fit: 'cover',
      position: 'center',
    }).webp({ quality: 75 }).toFile(iconFilePath);
  } catch (error) {
    console.error(
      `MEDIA: Could not create thumbnails for ${filePath} ${error.message}`,
    );
    throw error;
  }
}


/*
 * create path to media file by shortid and extension
 */
export function constructMediaPath(shortId, extension) {
  // eslint-disable-next-line max-len
  return path.resolve(MEDIA_FOLDER, shortId.substring(0, 2), shortId.substring(2, 4), `${shortId.substring(4, 6)}.${extension}`);
}

export function mimeTypeFitsToExt(mimeType, filename) {
  return filename.endsWith(`.${typeToExt(mimeType)}`);
}

export function isMimeTypeAllowed(mimeType) {
  if (typeToExt[mimeType]) {
    return true;
  }
  return false;
}

/**
 * store media file from filestream
 * @param fileStream
 * @param info { mimeType, filename }
 * @param [hashCheck] sha256 hash in hex that we check against
 * @param [restrictType] exclusive type to allow 'audio', 'video', 'image', ...
 * @return {
 *   hash,
 *   extension,
 *   mimeType,
 *   shortId,
 *   name,
 * }
 */
export async function processFileStream(
  fileStream, info, hashCheck, restrictType,
) {
  console.log('parse enter');
  const { mimeType } = info;

  /*
    * ensure sane type
    */
  const filename = info.filename?.trim();
  if (!filename || !mimeType) {
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }
    throw new Error('no_info');
  }
  const seperator = filename.lastIndexOf('.');
  const name = filename.substring(0, seperator);
  const extension = filename.substring(seperator + 1);
  const allowedExts = typeToExt[mimeType];

  if (!allowedExts
    || (Array.isArray(allowedExts) && !allowedExts.includes(extension))
    || (!Array.isArray(allowedExts) && extension !== allowedExts)
  ) {
    throw new Error('unknown_type');
  }

  let type;
  if (mimeType.startsWith('image/')) {
    type = 'image';
  } else if (mimeType.startsWith('video/')) {
    type = 'video';
  }
  if (restrictType && type !== restrictType) {
    throw new Error('invalid_type');
  }

  if (hashCheck) {
    /*
    * if hash got given already, check if file already exists
    */
    const existingMediaModel = await hasMedia(hashCheck, mimeType, name);
    if (existingMediaModel) {
      const existingFilePath = constructMediaPath(
        existingMediaModel.shortId, existingMediaModel.extension,
      );
      if (fs.existsSync(existingFilePath)) {
        /*
          * mark that it already exists, so that filestream can be recovered
          * if more files are to be read
          */
        existingMediaModel.existed = true;
        return existingMediaModel;
      }
      await deregisterMedia(hashCheck, mimeType);
    }
  }

  /*
    * store file temporary until we got hash
    */
  const tmpFolder = path.resolve(MEDIA_FOLDER, 'tmp');
  const temporaryFile = path.join(
    tmpFolder, `${getRandomString() + getRandomString()}.${extension}`,
  );
  let targetFile;

  /*
  * make sure temporary folder exists
  */
  if (!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, { recursive: true });
  }

  let model;

  try {
    const size = await new Promise((resolve, reject) => {
      let ended = false;
      let totalSize = 0;
      const startTime = Date.now();
      let timeoutStartTime;
      let timeout;

      const writeStream = fs.createWriteStream(temporaryFile);

      const cancel = (error) => {
        if (ended) {
          return;
        }
        ended = true;
        clearTimeout(timeout);
        writeStream.destroy();
        if (typeof error === 'string') {
          error = new Error(error);
        }
        reject(error);
      };

      /*
      * have to deel with drip-feeding data to hog up resources
      */
      const resetTimeout = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeoutStartTime = Date.now();
        timeout = setTimeout(() => cancel('stalled'), 30000);
      };

      resetTimeout();

      fileStream.on('data', (chunk) => {
        if (ended) {
          return;
        }
        totalSize += chunk.length;
        if (totalSize > MAX_MEDIA_SIZE) {
          cancel('too_long');
          return;
        }
        const now = Date.now();
        if (now - timeoutStartTime > 15000) {
          if (totalSize / (now - startTime) < 8) {
            cancel('stalled');
            return;
          }
          resetTimeout();
        }
      });

      fileStream.on('error', cancel);
      fileStream.on('limit', cancel);
      writeStream.on('error', cancel);

      fileStream.on('close', () => console.log('reading done'));
      writeStream.on('close', () => {
        if (ended) {
          return;
        }
        console.log('writing done');
        ended = true;
        clearTimeout(timeout);
        resolve(totalSize);
      });

      fileStream.pipe(writeStream);
    });

    /*
    * strip exif data
    */
    console.log('strip exif');
    await stripExif(temporaryFile);

    /*
    * calculate hash
    */
    console.log('calculate hash');
    const hash = await calculateHash(temporaryFile);

    /*
    * check if file already exists
    */
    console.log('save model');
    const existingMediaModel = await hasMedia(hash, mimeType, name);
    if (existingMediaModel) {
      const existingFilePath = constructMediaPath(
        existingMediaModel.shortId, existingMediaModel.extension,
      );
      if (fs.existsSync(existingFilePath)) {
        return existingMediaModel;
      }
      await deregisterMedia(hash, mimeType);
    }

    model = await registerMedia(
      hash, extension, mimeType, type, size, name,
    );
    if (!model) {
      throw new Error('server_error');
    }

    /*
      * move it to target folder by hash
      */
    targetFile = `${model.shortId}.${extension}`;
    const targetFolder = path.resolve(
      MEDIA_FOLDER,
      targetFile.substring(0, 2),
      targetFile.substring(2, 4),
    );
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    targetFile = path.resolve(targetFolder, targetFile.substring(4));
    fs.renameSync(temporaryFile, targetFile);
  } finally {
    if (fs.existsSync(temporaryFile)) {
      fs.rmSync(temporaryFile);
    }
  }

  try {
    /*
      * create thumbnails
      */
    if (type === 'image') {
      await createImageThumbnails(targetFile);
    } else if (type === 'video') {
      await createVideoThumbnails(targetFile);
    }

    console.log('parse leave');
    return model;
  } catch (error) {
    await deregisterMedia(model.hash, model.mimeType);
    fs.rmSync(targetFile);
    throw error;
  }
}
