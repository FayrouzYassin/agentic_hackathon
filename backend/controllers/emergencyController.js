'use strict';

const EmergencyLog = require('../models/EmergencyLog');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateBystanderInstructions } = require('../services/aiService');
const { buildTelUri, notifyEmergencyContact } = require('../utils/notify');
const { t } = require('../utils/i18n');

/**
 * Returns the stored instructions, generating and caching them first if setup
 * could not reach the model. Never throws: the emergency screen must render
 * the photo, the name and the call button even when the LLM is unavailable.
 *
 * @param {import('mongoose').HydratedDocument<any>} user
 * @returns {Promise<{text: string|null, source: 'stored'|'generated'|'unavailable'}>}
 */
async function resolveInstructions(user) {
  if (user.instructions && user.instructions.text) {
    return { text: user.instructions.text, source: 'stored' };
  }

  try {
    const generated = await generateBystanderInstructions({
      condition: user.condition,
      language: user.language,
    });

    user.instructions = {
      text: generated.text,
      language: generated.language,
      model: generated.model,
      generatedAt: new Date(),
    };
    await user.save();

    return { text: generated.text, source: 'generated' };
  } catch (error) {
    console.error(
      `[emergency] instructions unavailable: ${error.messageKey || error.message}`,
    );
    return { text: null, source: 'unavailable' };
  }
}

/**
 * Writes the audit record. A failure here is logged but never propagated -
 * losing a log entry must not break an emergency response.
 *
 * @param {object} entry
 * @returns {Promise<string|null>} the log id, or null if it could not be stored
 */
async function recordEmergency(entry) {
  try {
    const log = await EmergencyLog.create(entry);
    return log.id;
  } catch (error) {
    console.error('[emergency] could not write log entry:', error.message);
    return null;
  }
}

/**
 * POST /api/emergency/trigger
 *
 * Returns everything the emergency display page needs, in the patient's
 * language, and alerts the emergency contact through the configured channel.
 *
 * @type {import('express').RequestHandler}
 */
async function triggerEmergency(req, res, next) {
  const user = await User.findById(req.validated.userId);

  if (!user) {
    next(ApiError.notFound('user.notFound'));
    return;
  }

  const language = user.language;
  const instructions = await resolveInstructions(user);

  const notification = await notifyEmergencyContact({
    contact: user.emergencyContact,
    patientName: user.name,
    language,
  });

  const logId = await recordEmergency({
    user: user._id,
    language,
    instructionsSource: instructions.source,
    notification,
  });

  res.status(200).json({
    success: true,
    triggeredAt: new Date().toISOString(),
    language,
    logId,
    patient: {
      id: user.id,
      name: user.name,
      photoUrl: user.photoUrl,
    },
    instructions: instructions.text,
    warning: instructions.text ? null : t(language, 'instructions.pending'),
    emergencyContact: {
      name: user.emergencyContact.name,
      phone: user.emergencyContact.phone,
      relation: user.emergencyContact.relation,
      telUri: buildTelUri(user.emergencyContact.phone),
    },
    contactNotification: {
      status: notification.status,
      channel: notification.channel,
    },
  });
}

module.exports = { triggerEmergency };
