'use client';

import { decryptSecret, encryptSecret, getStoredItem, loadSettings, removeStoredItem, saveSettings, setStoredItem } from './storage';
import type { ApiConnectionTestResult, ApiKeyName, SecretKeys } from './types';

const SECRET_STORAGE_KEYS: Record<ApiKeyName, string> = {
  elevenLabs: 'doodle-key-elevenlabs',
  did: 'doodle-key-did',
};

const STATUS_KEY = 'doodle-key-statuses';
const CUSTOM_LLM_KEY = 'doodle-key-custom-llm';
const CUSTOM_IMAGE_KEY = 'doodle-key-custom-image';
const LEGACY_IMAGE_KEY = 'doodle-key-image';

export async function loadSecretKeys(): Promise<SecretKeys> {
  return {
    elevenLabs: await decryptSecret(getStoredItem(SECRET_STORAGE_KEYS.elevenLabs) || ''),
    did: await decryptSecret(getStoredItem(SECRET_STORAGE_KEYS.did) || ''),
  };
}

export async function saveSecretKeys(keys: Partial<SecretKeys>) {
  await Promise.all(
    (Object.entries(keys) as Array<[ApiKeyName, string | undefined]>).map(async ([name, value]) => {
      if (value == null) return;
      if (value) setStoredItem(SECRET_STORAGE_KEYS[name], await encryptSecret(value));
      else removeStoredItem(SECRET_STORAGE_KEYS[name]);
    }),
  );
}

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

export function loadKeyStatuses(): Partial<Record<ApiKeyName, ApiConnectionTestResult>> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(getStoredItem(STATUS_KEY) || '{}') as Partial<Record<ApiKeyName, ApiConnectionTestResult>>;
  } catch {
    return {};
  }
}

export function saveKeyStatus(result: ApiConnectionTestResult) {
  if (typeof window === 'undefined') return;
  const statuses = loadKeyStatuses();
  statuses[result.key] = result;
  setStoredItem(STATUS_KEY, JSON.stringify(statuses));
}

export function missingRequiredKeys(keys: SecretKeys) {
  return {
    elevenLabs: !keys.elevenLabs,
    did: !keys.did,
  };
}

function clearLegacyImageSettings(settings: ReturnType<typeof loadSettings> & { imageApiKey?: string }) {
  if (!settings.imageApiKey) return;
  const nextSettings = { ...settings };
  delete nextSettings.imageApiKey;
  saveSettings(nextSettings);
}
