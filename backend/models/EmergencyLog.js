'use strict';

const mongoose = require('mongoose');

const { SUPPORTED_LANGUAGES } = require('../utils/i18n');

/**
 * Audit trail for every emergency screen that was opened.
 * Deliberately stores references and outcomes only - no copies of the
 * patient's personal data, which already lives on the User document.
 */
const emergencyLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  language: { type: String, enum: SUPPORTED_LANGUAGES, required: true },
  instructionsSource: {
    type: String,
    enum: ['stored', 'generated', 'unavailable'],
    required: true,
  },
  notification: {
    status: {
      type: String,
      enum: ['sent', 'skipped', 'failed'],
      required: true,
    },
    channel: { type: String, maxlength: 40, default: null },
    detail: { type: String, maxlength: 300, default: null },
  },
  triggeredAt: { type: Date, default: Date.now, index: true },
});

emergencyLogSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('EmergencyLog', emergencyLogSchema);
