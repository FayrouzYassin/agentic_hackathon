'use strict';

const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { toPublicUrl } = require('../middleware/upload');
const { generateBystanderInstructions } = require('../services/aiService');
const { t } = require('../utils/i18n');

/**
 * Shapes a user document for both frontend pages.
 * @param {import('mongoose').HydratedDocument<any>} user
 * @returns {object}
 */
function toProfileResponse(user) {
  return {
    id: user.id,
    name: user.name,
    photoUrl: user.photoUrl,
    condition: user.condition,
    language: user.language,
    emergencyContact: {
      name: user.emergencyContact.name,
      phone: user.emergencyContact.phone,
      relation: user.emergencyContact.relation,
    },
    instructions: user.instructions ? user.instructions.text : null,
    instructionsGeneratedAt: user.instructions ? user.instructions.generatedAt : null,
    createdAt: user.createdAt,
  };
}

/**
 * POST /api/users/setup
 *
 * Stores the patient profile and asks Claude for the bystander instructions.
 * If the model is unreachable the profile is still saved: onboarding must not
 * fail because of a transient LLM outage, and the instructions are generated on
 * demand the first time the emergency screen is opened.
 *
 * @type {import('express').RequestHandler}
 */
async function setupUser(req, res) {
  const { name, condition, language, emergencyContact } = req.validated;

  const user = new User({
    name,
    condition,
    language,
    emergencyContact,
    photoUrl: toPublicUrl(req.file.filename),
  });

  let warning = null;

  try {
    const generated = await generateBystanderInstructions({ condition, language });
    user.instructions = {
      text: generated.text,
      language: generated.language,
      model: generated.model,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error(`[users] instruction generation failed: ${error.messageKey || error.message}`);
    warning = t(language, 'instructions.pending');
  }

  // A save failure is forwarded by Express 5; the error handler removes the
  // uploaded photo so no orphan file is left behind.
  await user.save();

  res.status(201).json({
    success: true,
    warning,
    user: toProfileResponse(user),
  });
}

/**
 * GET /api/users/:id
 * Feeds the emergency display page.
 * @type {import('express').RequestHandler}
 */
async function getUser(req, res, next) {
  const user = await User.findById(req.validated.id);

  if (!user) {
    next(ApiError.notFound('user.notFound'));
    return;
  }

  res.json({ success: true, user: toProfileResponse(user) });
}

module.exports = { getUser, setupUser, toProfileResponse };
