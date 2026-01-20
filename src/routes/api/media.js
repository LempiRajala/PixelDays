/*
 * media upload API, multipart form data requests with json responses
 */
import express from 'express';
import busboy from 'busboy';

import {
  processFileStream, isMimeTypeAllowed, mimeTypeFitsToExt,
} from '../../middleware/media.js';
import { MAX_MEDIA_SIZE, MAX_UPLOAD_AMOUNT } from '../../core/constants.ts';
import { hasMedia } from '../../data/sql/Media.js';

const router = express.Router();

/*
 * preflight route tells whether or not the upload is likely to succeed,
 * and if the file is already uploaded
 */
router.post('/preflight', (req, res) => {
  const { ttag: { t } } = req;
  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: 120 * 1024,
      files: 0,
      fields: 50,
    },
  });

  const errors = [];
  const mimeTypes = [];
  const filenames = [];
  const hashes = [];
  const sizes = [];

  bb.on('field', (name, value) => {
    switch (name) {
      case 'mimeType':
        mimeTypes.push(value);
        break;
      case 'filename':
        filenames.push(value);
        break;
      case 'size':
        sizes.push(Number(value));
        break;
      case 'hash':
        hashes.push(value);
        break;
      default:
        // nothing
    }
  });

  bb.on('error', () => {
    if (res.headersSent) {
      return;
    }
    res.status(500).json({
      readyToUpload: [],
      availableFiles: {},
      errors: ['Processing failed'],
    });
  });

  bb.on('close', () => {
    if (res.headersSent) {
      return;
    }

    // eslint-disable-next-line max-len
    if (mimeTypes.length !== filenames.length || filenames.length !== hashes.length || hashes.length !== sizes.length) {
      errors.push(t`You did not provide all neccessary information`);
      return;
    }
    if (mimeTypes.length > MAX_UPLOAD_AMOUNT) {
      const amountOfFiles = mimeTypes.length;
      errors.push(
        // eslint-disable-next-line max-len
        t`Can not upload this many files at once, only 5 are allowed, you have ${amountOfFiles}`,
      );
    }

    const promises = [];
    const readyToUpload = [];

    while (mimeTypes.length) {
      let fileErrors = false;
      const mimeType = mimeTypes.shift();
      const filename = filenames.shift();
      const hash = hashes.shift();
      const size = sizes.shift();

      if (size > MAX_MEDIA_SIZE) {
        const maxSizeMB = Math.floor(MAX_MEDIA_SIZE / 1024 / 10.24) / 100;
        const sizeMB = Math.floor(size / 1024 / 10.24) / 100;
        errors.push(
          // eslint-disable-next-line max-len
          t`File ${filename} has ${sizeMB} and is too large. It may only be ${maxSizeMB} MB`,
        );
        fileErrors = true;
      }
      if (!isMimeTypeAllowed(mimeType)) {
        errors.push(
          t`Mimetype ${mimeType} of file ${filename} is invalid or not allowed`,
        );
        fileErrors = true;
      } else if (!mimeTypeFitsToExt(mimeType, filename)) {
        errors.push(
          t`File ${filename} has an invalid extension`,
        );
        fileErrors = true;
      }

      if (!fileErrors) {
        const seperator = filename.lastIndexOf('.');
        const name = filename.substring(0, seperator);
        const extension = filename.substring(seperator + 1);
        promises.push(hasMedia(hash, mimeType, name));
        readyToUpload.push({ hash, name, mimeType, extension });
      }
    }

    Promise.all(promises).then((fileModels) => {
      const availableFiles = [];
      for (let i = 0; i < fileModels.length; i += 1) {
        const fileModel = fileModels[i];
        if (fileModel) {
          const { hash } = fileModel;
          readyToUpload.splice(readyToUpload.findIndex(
            (model) => model.hash === hash,
          ));
          /*
           *  [{ hash, name, mimeType, extension, shortId }, ... ]
           */
          availableFiles.push(fileModel);
        }
      }

      if (readyToUpload.length > MAX_UPLOAD_AMOUNT) {
        readyToUpload.splice(0, readyToUpload.length - MAX_UPLOAD_AMOUNT);
      }

      const data = { readyToUpload, availableFiles };
      if (errors.length) {
        data.errors = errors;
        res.status(400);
      }
      res.json(data);
    });
  });

  req.pipe(busboy);
});

router.post('/upload', (req, res) => {
  console.log('got upload');
  const { ttag: { t } } = req;
  const bb = busboy({ headers: req.headers });

  /*
   * amount of files, which can be given by the client in the 'amount' field,
   * it is used to end a request in advance, if a hash got detected to already
   * exist
   */
  let fileAmount = 1;
  /*
   * there might be a hash field given with the file, in which case we use the
   * hash to check for existence first
   */
  const hashes = [];
  /*
   * the hash field should arrive before the file, but it might come later,
   * which makes them useless, so we keep track of leading files to drop them
   */
  let leadingFiles = 0;
  /*
   * amount of files currently being read
   */
  let readingFiles = 0;
  /*
   * amount of files already read
   */
  let loadedFiles = 0;
  /*
   * whee reading the request body is done
   */
  let requestDone = false;
  /*
   * file modals
   * [{ hash, name, mimeType, extension, shortId}, ...]
   */
  const availableFiles = [];

  let ended = false;

  const finalize = (error) => {
    console.log('finalize');
    if (ended || (!error && (!requestDone || readingFiles > 0))) {
      return;
    }

    if (error && typeof error !== 'string') {
      error = error.message;
    }

    console.log('ending file upload', error);
    ended = true;
    if (error && !bb.destroyed) {
      console.log('destroy bb');
      bb.destroy();
    }
    const data = { availableFiles };

    if (error) {
      switch (error) {
        case 'no_info':
          error = t`No file metadata given`;
          break;
        case 'unknown_type':
          error = t`MimeType or extension not known or supported`;
          break;
        case 'invalid_type':
          error = t`Invalid type of media`;
          break;
        case 'server_error':
          error = t`Server Eror`;
          break;
        case 'stalled':
          error = t`Request stalled`;
          break;
        case 'too_long':
          error = t`A filewas too large`;
          break;
        case 'already_exists':
          /* this is not an error, but treated as one to cancel request */
          error = null;
          break;
        default:
          // nothing
      }
    }
    if (error) {
      data.errors = [error];
      res.status(400);
      res.on('finish', () => req.destroy());
    }
    res.json(data);
  };

  bb.on('file', (name, fileStream, info) => {
    console.log(`File [${name}]:`, info);
    if (name !== 'file') {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize(t`Unknown field ${name} in request`);
      return;
    }
    /*
      * can be multiple files with same fieldname
      */
    loadedFiles += 1;
    if (loadedFiles > MAX_UPLOAD_AMOUNT) {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize(t`Could not upload all files`);
      return;
    }
    const hash = hashes.shift();
    if (!hash) {
      leadingFiles += 1;
    }
    readingFiles += 1;

    processFileStream(fileStream, info, hash).then((modal) => {
      availableFiles.push(modal);
      if (modal.existed) {
        delete modal.existed;
        if (fileAmount <= 1) {
          if (!fileStream.destroyed) {
            fileStream.destroy();
          }
          finalize('already_exists');
          return;
        }
        fileAmount -= 1;
      }
      if (!fileStream.closed) {
        fileStream.resume();
      }
      readingFiles -= 1;
      finalize();
    }).catch((error) => {
      if (!fileStream.destroyed && !fileStream.closed) {
        fileStream.destroy();
      }
      finalize(error);
    });
  });

  bb.on('field', (name, value) => {
    console.log(`Field [${name}]:`, value);
    if (name === 'amount') {
      fileAmount = Number(value);
      return;
    }
    if (name === 'hash') {
      if (leadingFiles > 0) {
        leadingFiles -= 1;
        return;
      }
      hashes.push(value);
    }
  });

  bb.on('error', () => {
    finalize('server_error');
  });

  bb.on('close', () => {
    requestDone = true;
    finalize();
  });

  req.pipe(bb);
});

export default router;
