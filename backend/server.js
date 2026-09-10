'use strict';

require('dotenv').config({ quiet: true });

const path = require('path');

const cors = require('cors');
const express = require('express');
const multer = require('multer');

const { connectDB, disconnectDB } = require('./config/db');
const emergencyRoutes = require('./routes/emergencyRoutes');
const userRoutes = require('./routes/userRoutes');
const ApiError = require('./utils/apiError');
const { maxUploadBytes, removeUploadedFile, uploadDir } = require('./middleware/upload');
const { resolveLanguage } = require('./middleware/validate');
const { t } = require('./utils/i18n');

// MONGO_URI is intentionally NOT required: when it is missing the app falls
// back to a temporary in-memory MongoDB (see config/db.js) so the demo runs
// with `node server.js` alone. Add MONGO_URI back here if you later make a
// real MongoDB Atlas connection mandatory.
const REQUIRED_ENV = ['ANTHROPIC_API_KEY'];
const DEFAULT_PORT = 5000;
const JSON_BODY_LIMIT = '100kb';

/** Stops the process early with a clear message instead of failing per request. */
function assertRequiredEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill it in.',
    );
  }
}

/**
 * `*` (the default) allows any origin, which is convenient while the frontend
 * runs from a phone or a tunnel. Set ALLOWED_ORIGINS in production.
 * @returns {import('cors').CorsOptions}
 */
function buildCorsOptions() {
  const configured = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.includes('*')) {
    return { origin: true };
  }
  return { origin: configured };
}

const app = express();

app.disable('x-powered-by');
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Patient photos are served straight from disk so the emergency page can
// render them with a plain <img src="...">.
app.use(`/${path.basename(uploadDir)}`, express.static(uploadDir, { maxAge: '1d' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});

app.use('/api/users', userRoutes);
app.use('/api/emergency', emergencyRoutes);

app.use((_req, _res, next) => {
  next(ApiError.notFound('errors.routeNotFound'));
});

/**
 * Single place that turns any thrown error into a localised JSON response.
 * Express 5 forwards rejected promises from async handlers here automatically.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies the handler by arity.
app.use((error, req, res, next) => {
  const language = req.language || resolveLanguage(req);

  // A request that ends in an error never stores a profile, so the photo that
  // multer already wrote to disk would otherwise be orphaned.
  removeUploadedFile(req.file);

  if (error instanceof ApiError) {
    res.status(error.status).json({
      success: false,
      error: t(language, error.messageKey, error.vars),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const key =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'validation.photoTooLarge'
        : 'validation.unexpectedUpload';
    res.status(400).json({
      success: false,
      error: t(language, key, { maxMb: Math.round(maxUploadBytes / (1024 * 1024)) }),
    });
    return;
  }

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    res.status(400).json({ success: false, error: t(language, 'validation.invalidBody') });
    return;
  }

  if (error.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: t(language, 'errors.payloadTooLarge') });
    return;
  }

  console.error('[server] unhandled error:', error);
  res.status(500).json({ success: false, error: t(language, 'errors.server') });
});

/** Boots the process: validate config, connect to MongoDB, then listen. */
async function start() {
  assertRequiredEnv();
  await connectDB();

  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const server = app.listen(port, () => {
    console.info(`[server] listening on http://localhost:${port}`);
  });

  const shutdown = (signal) => {
    console.info(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only boot when run directly (`node server.js`), so tests can import the app.
if (require.main === module) {
  start().catch((error) => {
    console.error('[server] failed to start:', error.message);
    process.exit(1);
  });
}

module.exports = app;
