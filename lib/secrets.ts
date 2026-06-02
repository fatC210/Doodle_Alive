'use client';

import { decryptSecret, encryptSecret, getStoredItem, loadSettings, removeStoredItem, saveSettings, setStoredItem } from './storage';

const CUSTOM_LLM_KEY = 'doodle-key-custom-llm';
const CUSTOM_IMAGE_KEY = 'doodle-key-custom-image';
const DID_API_KEY = 'doodle-key-did-api';
const LEGACY_IMAGE_KEY = 'doodle-key-image';

export async function loadCustomLlmKey() {
  return decryptSecret(getStoredItem(CUSTOM_LLM_KEY) || '');
}

export async function saveCustomLlmKey(value: string) {
  if (value) setStoredItem(CUSTOM_LLM_KEY, await encryptSecret(value));
  else removeStoredItem(CUSTOM_LLM_KEY);
}

export async function loadCustomImageKey() {
  const stored = getStoredItem(CUSTOM_IMAGE_KEY);
  if (stored) return decryptSecret(stored);

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
  if (value) setStoredItem(CUSTOM_IMAGE_KEY, await encryptSecret(value));
  else removeStoredItem(CUSTOM_IMAGE_KEY);
  removeStoredItem(LEGACY_IMAGE_KEY);
  clearLegacyImageSettings(loadSettings() as ReturnType<typeof loadSettings> & { imageApiKey?: string });
}

export async function loadDidApiKey() {
  return decryptSecret(getStoredItem(DID_API_KEY) || '');
}

export async function saveDidApiKey(value: string) {
  if (value) setStoredItem(DID_API_KEY, await encryptSecret(value));
  else removeStoredItem(DID_API_KEY);
}

function clearLegacyImageSettings(settings: ReturnType<typeof loadSettings> & { imageApiKey?: string }) {
  if (!settings.imageApiKey) return;
  const nextSettings = { ...settings };
  delete nextSettings.imageApiKey;
  saveSettings(nextSettings);
}
