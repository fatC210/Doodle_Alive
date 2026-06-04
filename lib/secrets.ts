'use client';

import { decryptSecret, encryptSecret, getStoredItem, isCurrentSecretCipher, loadSettings, removeStoredItem, saveSettings, setStoredItem } from './storage';

const CUSTOM_LLM_KEY = 'doodle-key-custom-llm';
const CUSTOM_IMAGE_KEY = 'doodle-key-custom-image';
const DID_API_KEY = 'doodle-key-did-api';
const DID_API_KEY_VERIFIED = 'doodle-key-did-api-verified';
const LEGACY_IMAGE_KEY = 'doodle-key-image';

let customLlmKeyWriteId = 0;
let customImageKeyWriteId = 0;
let didApiKeyWriteId = 0;

export async function loadCustomLlmKey() {
  const stored = getStoredItem(CUSTOM_LLM_KEY);
  if (!stored) return '';
  const value = await decryptSecret(stored);
  if (value && !isCurrentSecretCipher(stored)) await saveCustomLlmKey(value);
  return value;
}

export async function saveCustomLlmKey(value: string) {
  const writeId = customLlmKeyWriteId + 1;
  customLlmKeyWriteId = writeId;
  if (value) {
    const encryptedValue = await encryptSecret(value);
    if (writeId !== customLlmKeyWriteId) return;
    setStoredItem(CUSTOM_LLM_KEY, encryptedValue);
  } else {
    removeStoredItem(CUSTOM_LLM_KEY);
  }
}

export async function loadCustomImageKey() {
  const stored = getStoredItem(CUSTOM_IMAGE_KEY);
  if (stored) {
    const value = await decryptSecret(stored);
    if (value && !isCurrentSecretCipher(stored)) await saveCustomImageKey(value);
    return value;
  }

  const legacyStored = getStoredItem(LEGACY_IMAGE_KEY);
  if (legacyStored) {
    const legacyValue = await decryptSecret(legacyStored);
    if (legacyValue) {
      await saveCustomImageKey(legacyValue);
      return legacyValue;
    }
  }

  const settings = loadSettings() as ReturnType<typeof loadSettings> & { imageApiKey?: string };
  if (settings.imageApiKey) {
    const legacyValue = settings.imageApiKey;
    await saveCustomImageKey(legacyValue);
    clearLegacyImageSettings(settings);
    return legacyValue;
  }

  return '';
}

export async function saveCustomImageKey(value: string) {
  const writeId = customImageKeyWriteId + 1;
  customImageKeyWriteId = writeId;
  const trimmedValue = value.trim();
  if (trimmedValue) {
    const encryptedValue = await encryptSecret(trimmedValue);
    if (writeId !== customImageKeyWriteId) return;
    setStoredItem(CUSTOM_IMAGE_KEY, encryptedValue);
  } else {
    removeStoredItem(CUSTOM_IMAGE_KEY);
  }
  removeStoredItem(LEGACY_IMAGE_KEY);
  clearLegacyImageSettings(loadSettings() as ReturnType<typeof loadSettings> & { imageApiKey?: string });
}

export async function loadDidApiKey() {
  const stored = getStoredItem(DID_API_KEY);
  if (!stored) return '';
  const value = await decryptSecret(stored);
  if (value && !isCurrentSecretCipher(stored)) await saveDidApiKey(value);
  return value;
}

export async function saveDidApiKey(value: string) {
  const writeId = didApiKeyWriteId + 1;
  didApiKeyWriteId = writeId;
  const trimmedValue = value.trim();
  if (trimmedValue) {
    const encryptedValue = await encryptSecret(trimmedValue);
    if (writeId !== didApiKeyWriteId) return;
    setStoredItem(DID_API_KEY, encryptedValue);
  } else {
    removeStoredItem(DID_API_KEY);
    removeStoredItem(DID_API_KEY_VERIFIED);
  }
}

export async function isDidApiKeyVerified(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;
  return getStoredItem(DID_API_KEY_VERIFIED) === await digestSecret(trimmedValue);
}

export async function markDidApiKeyVerified(value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue && await loadDidApiKey() === trimmedValue) {
    setStoredItem(DID_API_KEY_VERIFIED, await digestSecret(trimmedValue));
  }
}

function clearLegacyImageSettings(settings: ReturnType<typeof loadSettings> & { imageApiKey?: string }) {
  if (!settings.imageApiKey) return;
  const nextSettings = { ...settings };
  delete nextSettings.imageApiKey;
  saveSettings(nextSettings);
}

async function digestSecret(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
