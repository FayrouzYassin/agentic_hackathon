'use strict';

const { t } = require('./i18n');

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Builds the `tel:` URI the frontend puts behind the "Call Emergency Contact"
 * button. Only digits and a leading `+` survive, which is what dialers accept.
 * @param {string} phone
 * @returns {string}
 */
function buildTelUri(phone) {
  const digits = String(phone).replace(/\D/g, '');
  const plus = String(phone).trim().startsWith('+') ? '+' : '';
  return `tel:${plus}${digits}`;
}

/**
 * Sends an out-of-band alert to the emergency contact, if a delivery channel is
 * configured through EMERGENCY_WEBHOOK_URL (SMS gateway, on-call service, ...).
 *
 * The bystander always has the `tel:` button, so this is a best-effort extra:
 * it never throws and never blocks the emergency response.
 *
 * @param {{
 *   contact: { name: string, phone: string, relation: string },
 *   patientName: string,
 *   language: 'en'|'ar',
 * }} params
 * @returns {Promise<{status: 'sent'|'skipped'|'failed', channel: string|null, detail: string|null}>}
 */
async function notifyEmergencyContact({ contact, patientName, language }) {
  const webhookUrl = (process.env.EMERGENCY_WEBHOOK_URL || '').trim();

  if (!webhookUrl) {
    return {
      status: 'skipped',
      channel: null,
      detail: 'no outbound channel configured',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: contact.phone,
        language,
        message: t(language, 'emergency.contactAlert', { patientName }),
        triggeredAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[notify] webhook responded with ${response.status}`);
      return {
        status: 'failed',
        channel: 'webhook',
        detail: `webhook status ${response.status}`,
      };
    }

    return { status: 'sent', channel: 'webhook', detail: null };
  } catch (error) {
    const detail = error.name === 'AbortError' ? 'webhook timed out' : 'webhook unreachable';
    console.error(`[notify] ${detail}: ${error.message}`);
    return { status: 'failed', channel: 'webhook', detail };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { buildTelUri, notifyEmergencyContact };
