'use strict';

const mongoose = require('mongoose');

const ApiError = require('../utils/apiError');
const { SUPPORTED_LANGUAGES, normalizeLanguage } = require('../utils/i18n');

const LIMITS = Object.freeze({
  name: { min: 2, max: 80 },
  condition: { min: 5, max: 1000 },
  contactName: { min: 2, max: 80 },
  contactRelation: { min: 2, max: 40 },
});

/** Digits, optional leading +, plus the usual separators people type. */
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;

/** C0/C1 control characters, keeping tab, newline and carriage return. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]', 'g');

/**
 * Accepts a value only if it really is a string. Rejecting objects and arrays
 * here is what keeps query-operator payloads (`{"$ne": null}`) out of Mongoose.
 * Control characters are stripped so stored text cannot corrupt logs or output.
 * @param {unknown} value
 * @returns {string|null} the cleaned string, or null when the value is not a string
 */
function asCleanString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return value.replace(CONTROL_CHARS, '').trim();
}

/**
 * @param {unknown} value
 * @param {{min: number, max: number}} bounds
 * @param {string} messageKey translation key used when the value is rejected
 * @returns {string}
 * @throws {ApiError}
 */
function requireText(value, bounds, messageKey) {
  const text = asCleanString(value);
  if (!text || text.length < bounds.min || text.length > bounds.max) {
    throw ApiError.badRequest(messageKey);
  }
  return text;
}

/**
 * Keeps only the digits and an optional leading `+`, so what is stored can be
 * dialled directly from a `tel:` link.
 * @param {unknown} value
 * @returns {string}
 * @throws {ApiError}
 */
function requirePhone(value) {
  const raw = asCleanString(value);
  if (!raw || !PHONE_PATTERN.test(raw)) {
    throw ApiError.badRequest('validation.contactPhone');
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    throw ApiError.badRequest('validation.contactPhone');
  }
  return raw.startsWith('+') ? `+${digits}` : digits;
}

/**
 * The emergency contact may arrive either as flat multipart fields
 * (`contactName`, `contactPhone`, `contactRelation`) or as a JSON string in
 * `emergencyContact`. Both shapes are supported so the frontend can pick one.
 * @param {Record<string, unknown>} body
 * @returns {{name: unknown, phone: unknown, relation: unknown}}
 * @throws {ApiError}
 */
function readContactFields(body) {
  let nested = body.emergencyContact;

  if (typeof nested === 'string') {
    try {
      nested = JSON.parse(nested);
    } catch {
      throw ApiError.badRequest('validation.invalidBody');
    }
  }
  if (nested !== undefined && (typeof nested !== 'object' || nested === null)) {
    throw ApiError.badRequest('validation.invalidBody');
  }

  return {
    name: body.contactName ?? nested?.name,
    phone: body.contactPhone ?? nested?.phone,
    relation: body.contactRelation ?? nested?.relation,
  };
}

/**
 * Reads the requested language from the body, the query string or the
 * Accept-Language header, in that order.
 * @param {import('express').Request} req
 * @returns {'en'|'ar'}
 */
function resolveLanguage(req) {
  const fromBody =
    req.body && typeof req.body.language === 'string' ? req.body.language : null;
  const fromQuery =
    typeof req.query.language === 'string' ? req.query.language : null;
  const fromHeader =
    typeof req.headers['accept-language'] === 'string'
      ? req.headers['accept-language']
      : null;

  return normalizeLanguage(fromBody || fromQuery || fromHeader);
}

/**
 * Attaches the resolved language to the request so responses, generated
 * instructions and error messages all use one source of truth.
 * @type {import('express').RequestHandler}
 */
function attachLanguage(req, _res, next) {
  req.language = resolveLanguage(req);
  next();
}

/**
 * Validates POST /api/users/setup and exposes clean values on `req.validated`.
 * Runs after the upload middleware, so `req.file` is already populated.
 * @type {import('express').RequestHandler}
 */
function validateUserSetup(req, _res, next) {
  const body = req.body || {};

  try {
    const rawLanguage = body.language === undefined ? null : asCleanString(body.language);
    if (rawLanguage !== null && !SUPPORTED_LANGUAGES.includes(rawLanguage.toLowerCase())) {
      throw ApiError.badRequest('validation.language');
    }

    const language = normalizeLanguage(rawLanguage);
    req.language = language;

    if (!req.file) {
      throw ApiError.badRequest('validation.photoRequired');
    }

    const contact = readContactFields(body);

    req.validated = {
      name: requireText(body.name, LIMITS.name, 'validation.name'),
      condition: requireText(body.condition, LIMITS.condition, 'validation.condition'),
      language,
      emergencyContact: {
        name: requireText(contact.name, LIMITS.contactName, 'validation.contactName'),
        phone: requirePhone(contact.phone),
        relation: requireText(
          contact.relation,
          LIMITS.contactRelation,
          'validation.contactRelation',
        ),
      },
    };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Validates POST /api/emergency/trigger.
 * @type {import('express').RequestHandler}
 */
function validateEmergencyTrigger(req, _res, next) {
  const userId = asCleanString((req.body || {}).userId);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    next(ApiError.badRequest('validation.userId'));
    return;
  }

  req.validated = { userId };
  next();
}

/**
 * Validates an ObjectId route parameter (used by GET /api/users/:id).
 * @param {string} paramName
 * @returns {import('express').RequestHandler}
 */
function validateObjectIdParam(paramName) {
  return (req, _res, next) => {
    const value = asCleanString(req.params[paramName]);
    if (!value || !mongoose.isValidObjectId(value)) {
      next(ApiError.badRequest('validation.userId'));
      return;
    }
    req.validated = { ...(req.validated || {}), [paramName]: value };
    next();
  };
}

module.exports = {
  attachLanguage,
  resolveLanguage,
  validateEmergencyTrigger,
  validateObjectIdParam,
  validateUserSetup,
};
