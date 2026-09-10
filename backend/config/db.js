'use strict';

const mongoose = require('mongoose');

/**
 * TEMPORARY (hackathon demo): the app runs against an in-memory MongoDB.
 *
 * `mongodb-memory-server` spins up a real mongod process backed by RAM when the
 * server boots, so `node server.js` works with zero setup — no local mongod, no
 * Atlas account, no MONGO_URI. The trade-off is that **all data is wiped every
 * time the process restarts**. That is fine for a demo, not for production.
 *
 * ---------------------------------------------------------------------------
 * HOW TO SWITCH BACK TO A REAL MONGODB (Atlas or local) LATER
 * ---------------------------------------------------------------------------
 * 1. Put your connection string in `backend/.env`:
 *      MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/medical_alert
 *    (Atlas: Database > Connect > Drivers. Whitelist your IP under Network
 *    Access, and URL-encode any special characters in the password.)
 * 2. That is all — `connectDB()` below prefers MONGO_URI whenever it is set and
 *    only falls back to the in-memory server when it is absent.
 * 3. Optional cleanup once the demo is over: put `MONGO_URI` back in
 *    `REQUIRED_ENV` in `server.js`, drop the `mongodb-memory-server`
 *    dependency, and delete the in-memory branch below.
 * ---------------------------------------------------------------------------
 */

/** @type {import('mongodb-memory-server').MongoMemoryServer | null} */
let memoryServer = null;

/**
 * Starts the in-memory MongoDB and returns its connection string.
 * The package is required lazily so a real-MongoDB deployment never pays for
 * loading it (and can even remove the dependency).
 *
 * @returns {Promise<string>}
 */
async function startMemoryServer() {
  // eslint-disable-next-line global-require -- only needed in demo mode.
  const { MongoMemoryServer } = require('mongodb-memory-server');

  console.warn(
    '[db] MONGO_URI is not set — starting a TEMPORARY in-memory MongoDB for the demo. ' +
      'Data will be lost when the server stops.',
  );

  // The first run downloads a mongod binary (~100 MB) and caches it; later
  // starts are offline and take about a second.
  memoryServer = await MongoMemoryServer.create();

  // Pass the database name explicitly: the generated URI has no path, and
  // mongoose would otherwise fall back to "test".
  return memoryServer.getUri('medical_alert');
}

/**
 * Opens the MongoDB connection used by the whole process.
 * Uses MONGO_URI when provided, otherwise boots the in-memory demo database.
 * Fails fast on start-up: without a database the API cannot serve anything,
 * so it is better to exit than to accept traffic that will always error.
 *
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || (await startMemoryServer());

  mongoose.connection.on('error', (error) => {
    console.error('[db] connection error:', error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected from MongoDB');
  });
  mongoose.connection.on('reconnected', () => {
    console.info('[db] reconnected to MongoDB');
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.info(
      `[db] connected to "${mongoose.connection.name}"${memoryServer ? ' (in-memory)' : ''}`,
    );
    return mongoose;
  } catch (error) {
    console.error('[db] initial connection failed:', error.message);
    throw error;
  }
}

/** Closes the connection during graceful shutdown. */
async function disconnectDB() {
  await mongoose.connection.close();

  // Also stop the demo database, otherwise the mongod child process outlives us.
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
