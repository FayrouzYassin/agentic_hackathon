'use strict';

const mongoose = require('mongoose');

const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../utils/i18n');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    relation: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { _id: false },
);

/**
 * Instructions are generated once at setup and cached on the profile so the
 * emergency screen renders instantly and still works if the LLM is down.
 */
const instructionsSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    language: { type: String, enum: SUPPORTED_LANGUAGES, required: true },
    model: { type: String, required: true, maxlength: 80 },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  photoUrl: { type: String, required: true, trim: true, maxlength: 300 },
  condition: { type: String, required: true, trim: true, maxlength: 1000 },
  language: {
    type: String,
    enum: SUPPORTED_LANGUAGES,
    default: DEFAULT_LANGUAGE,
  },
  emergencyContact: { type: emergencyContactSchema, required: true },
  instructions: { type: instructionsSchema, default: null },
  createdAt: { type: Date, default: Date.now },
});

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
