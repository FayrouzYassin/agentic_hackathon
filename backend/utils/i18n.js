'use strict';

/**
 * Bilingual (English / Arabic) catalogue for every string that can reach a user.
 *
 * Rules for adding a key:
 *  - Add both `en` and `ar`. A missing translation falls back to English.
 *  - Keep placeholders in the `{name}` form; they are substituted by `t()`.
 */

const SUPPORTED_LANGUAGES = Object.freeze(['en', 'ar']);
const DEFAULT_LANGUAGE = 'en';

const LANGUAGE_LABELS = Object.freeze({
  en: 'English',
  ar: 'Arabic (العربية)',
});

const CATALOGUE = Object.freeze({
  'validation.invalidBody': {
    en: 'The request body could not be read. Send valid form data.',
    ar: 'تعذّرت قراءة محتوى الطلب. أرسل بيانات صحيحة.',
  },
  'validation.name': {
    en: 'Patient name is required and must be between 2 and 80 characters.',
    ar: 'اسم المريض مطلوب ويجب أن يكون بين حرفين و80 حرفًا.',
  },
  'validation.condition': {
    en: 'Condition description is required and must be between 5 and 1000 characters.',
    ar: 'وصف الحالة مطلوب ويجب أن يكون بين 5 و1000 حرف.',
  },
  'validation.language': {
    en: 'Language must be either "en" or "ar".',
    ar: 'يجب أن تكون اللغة "en" أو "ar".',
  },
  'validation.contactName': {
    en: 'Emergency contact name is required and must be between 2 and 80 characters.',
    ar: 'اسم جهة الاتصال للطوارئ مطلوب ويجب أن يكون بين حرفين و80 حرفًا.',
  },
  'validation.contactPhone': {
    en: 'Emergency contact phone is required and must be a valid phone number.',
    ar: 'رقم هاتف جهة الاتصال للطوارئ مطلوب ويجب أن يكون رقمًا صحيحًا.',
  },
  'validation.contactRelation': {
    en: 'Relation to the emergency contact is required (2 to 40 characters).',
    ar: 'صلة القرابة بجهة الاتصال للطوارئ مطلوبة (من حرفين إلى 40 حرفًا).',
  },
  'validation.photoRequired': {
    en: 'A patient photo is required.',
    ar: 'صورة المريض مطلوبة.',
  },
  'validation.photoType': {
    en: 'Unsupported photo format. Use JPEG, PNG, WebP or HEIC.',
    ar: 'صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP أو HEIC.',
  },
  'validation.photoTooLarge': {
    en: 'The photo is too large. Maximum size is {maxMb} MB.',
    ar: 'حجم الصورة كبير جدًا. الحد الأقصى {maxMb} ميجابايت.',
  },
  'validation.unexpectedUpload': {
    en: 'Unexpected file field. Upload the photo under the field name "photo".',
    ar: 'حقل ملف غير متوقع. ارفع الصورة تحت اسم الحقل "photo".',
  },
  'validation.userId': {
    en: 'A valid user id is required.',
    ar: 'معرّف مستخدم صالح مطلوب.',
  },
  'user.notFound': {
    en: 'No patient profile was found for this id.',
    ar: 'لا يوجد ملف مريض بهذا المعرّف.',
  },
  'ai.timeout': {
    en: 'Generating the instructions took too long. Please try again.',
    ar: 'استغرق إنشاء التعليمات وقتًا طويلًا. حاول مرة أخرى.',
  },
  'ai.busy': {
    en: 'The instruction service is busy right now. Please try again shortly.',
    ar: 'خدمة إنشاء التعليمات مشغولة حاليًا. حاول بعد قليل.',
  },
  'ai.unavailable': {
    en: 'The instruction service is temporarily unavailable.',
    ar: 'خدمة إنشاء التعليمات غير متاحة مؤقتًا.',
  },
  'ai.failed': {
    en: 'The instructions could not be generated. Please try again.',
    ar: 'تعذّر إنشاء التعليمات. حاول مرة أخرى.',
  },
  'ai.notConfigured': {
    en: 'The instruction service is not configured on the server.',
    ar: 'خدمة إنشاء التعليمات غير مهيّأة على الخادم.',
  },
  'instructions.pending': {
    en: 'Bystander instructions are not ready yet. Call emergency services and use the contact button below.',
    ar: 'تعليمات المساعدة غير جاهزة بعد. اتصل بخدمات الطوارئ واستخدم زر الاتصال بالأسفل.',
  },
  'emergency.contactAlert': {
    en: '{patientName} triggered a medical emergency alert and may need help now.',
    ar: 'قام {patientName} بتفعيل تنبيه طوارئ طبية وقد يحتاج المساعدة الآن.',
  },
  'errors.routeNotFound': {
    en: 'The requested endpoint does not exist.',
    ar: 'المسار المطلوب غير موجود.',
  },
  'errors.payloadTooLarge': {
    en: 'The request is too large.',
    ar: 'حجم الطلب كبير جدًا.',
  },
  'errors.server': {
    en: 'Something went wrong on the server. Please try again.',
    ar: 'حدث خطأ في الخادم. حاول مرة أخرى.',
  },
});

/**
 * Narrows any incoming value to a supported language code.
 * @param {unknown} value
 * @returns {'en'|'ar'}
 */
function normalizeLanguage(value) {
  if (typeof value !== 'string') {
    return DEFAULT_LANGUAGE;
  }
  const code = value.trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}

/**
 * Translates a catalogue key, substituting `{placeholder}` tokens.
 * Unknown keys are returned as-is so a typo is visible instead of silent.
 * @param {'en'|'ar'} language
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
function t(language, key, vars = {}) {
  const entry = CATALOGUE[key];
  if (!entry) {
    return key;
  }
  const template = entry[normalizeLanguage(language)] || entry[DEFAULT_LANGUAGE];
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

module.exports = {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  t,
};
