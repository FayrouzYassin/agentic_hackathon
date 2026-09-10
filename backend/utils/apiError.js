'use strict';

/**
 * An error that carries an HTTP status and a translation key instead of a
 * user-facing string, so the error handler can render it in the language the
 * caller asked for.
 */
class ApiError extends Error {
  /**
   * @param {number} status HTTP status code to return.
   * @param {string} messageKey Key from `utils/i18n` catalogue.
   * @param {{ vars?: Record<string, string|number>, cause?: unknown }} [options]
   */
  constructor(status, messageKey, options = {}) {
    super(messageKey);
    this.name = 'ApiError';
    this.status = status;
    this.messageKey = messageKey;
    this.vars = options.vars || {};
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(messageKey, vars) {
    return new ApiError(400, messageKey, { vars });
  }

  static notFound(messageKey, vars) {
    return new ApiError(404, messageKey, { vars });
  }
}

module.exports = ApiError;
