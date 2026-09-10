'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const multer = require('multer');

const ApiError = require('../utils/apiError');

const DEFAULT_UPLOAD_DIR = 'uploads';
const DEFAULT_MAX_UPLOAD_MB = 5;

/** Extension is derived from the MIME type, never from the client filename. */
const ALLOWED_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
});

const uploadDir = path.resolve(
  __dirname,
  '..',
  process.env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR,
);

const maxUploadBytes =
  (Number(process.env.MAX_UPLOAD_MB) || DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // A random name avoids collisions and stops a crafted filename from
    // escaping the upload directory or leaking the patient's identity.
    cb(null, `${crypto.randomUUID()}${ALLOWED_TYPES[file.mimetype]}`);
  },
});

const uploadPhoto = multer({
  storage,
  limits: { fileSize: maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      cb(ApiError.badRequest('validation.photoType'));
      return;
    }
    cb(null, true);
  },
}).single('photo');

/**
 * Public URL for a stored file, matching the static route mounted in server.js.
 * @param {string} filename
 * @returns {string}
 */
function toPublicUrl(filename) {
  return `/${path.basename(uploadDir)}/${filename}`;
}

/**
 * Best-effort cleanup so a failed request does not leave an orphan photo.
 * @param {Express.Multer.File|undefined} file
 */
async function removeUploadedFile(file) {
  if (!file || !file.path) {
    return;
  }
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[upload] could not remove orphan file:', error.message);
    }
  }
}

module.exports = {
  maxUploadBytes,
  removeUploadedFile,
  toPublicUrl,
  uploadDir,
  uploadPhoto,
};
