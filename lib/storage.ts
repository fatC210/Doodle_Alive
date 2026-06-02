'use client';

import { defaultSettings } from './data';
import type { AdvancedSettings, ChatMessage, CreationDraft, DoodleCharacter } from './types';

const DB_NAME = 'doodle-alive';
const DB_VERSION = 1;
const CHARACTER_STORE = 'characters';
const MESSAGE_STORE = 'messages';
const DRAFT_KEY = 'doodle-creation-draft';
const SETTINGS_KEY = 'doodle-settings';
const STARTER_DATA_CLEANUP_KEY = 'doodle-starter-data-cleaned';
const FALLBACK_PREFIX = 'doodle-fallback-store:';
const LEGACY_STARTER_CHARACTER_IDS = ['lumi', 'rex', 'nova', 'bamboo', 'milo', 'zara'];
const LEGACY_PLACEHOLDER_ENDPOINT_HOSTS = ['api.your-llm-provider.com', 'api.your-image-provider.com'];

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryStorage = new Map<string, string>();

export const defaultDraft: CreationDraft = {
  step: 'DRAW',
  accentColors: [],
  backgroundColor: '#ffffff',
};

export async function getCharacters() {
  await removeLegacyStarterCharacters();
  return getAll<DoodleCharacter>(CHARACTER_STORE);
}

export async function getCharacter(id: string) {
  await removeLegacyStarterCharacters();
  return getByKey<DoodleCharacter>(CHARACTER_STORE, id);
}

export async function saveCharacter(character: DoodleCharacter) {
  return put(CHARACTER_STORE, character);
}

export async function deleteCharacter(characterId: string) {
  await removeByKey(CHARACTER_STORE, characterId);
  const messages = await getMessages(characterId);
  await Promise.all(messages.map((message) => removeByKey(MESSAGE_STORE, message.id)));
}

export async function getMessages(characterId: string) {
  const messages = await getAll<ChatMessage>(MESSAGE_STORE);
  return messages.filter((message) => message.characterId === characterId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function saveMessage(message: ChatMessage) {
  return put(MESSAGE_STORE, message);
}

export function loadDraft(): CreationDraft {
  if (typeof window === 'undefined') return defaultDraft;
  try {
    const stored = getStoredItem(DRAFT_KEY);
    return stored ? { ...defaultDraft, ...JSON.parse(stored) } : defaultDraft;
  } catch {
    return defaultDraft;
  }
}

export function saveDraft(nextDraft: Partial<CreationDraft>) {
  if (typeof window === 'undefined') return;
  const draft = { ...loadDraft(), ...nextDraft };
  setStoredItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  if (typeof window === 'undefined') return;
  removeStoredItem(DRAFT_KEY);
}

export function loadSettings(): AdvancedSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = getStoredItem(SETTINGS_KEY);
    return normalizeSettings(stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Partial<AdvancedSettings>) {
  if (typeof window === 'undefined') return;
  const nextSettings = normalizeSettings({ ...loadSettings(), ...settings });
  setStoredItem(SETTINGS_KEY, JSON.stringify(nextSettings));
}

export async function encryptSecret(value: string) {
  if (!value) return '';
  const cryptoKey = await deriveStorageKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(value: string) {
  if (!value || !value.includes('.')) return '';
  try {
    const [ivText, cipherText] = value.split('.');
    const cryptoKey = await deriveStorageKey();
    const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivText) }, cryptoKey, fromBase64(cipherText));
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then((response) => response.blob());
}

async function removeLegacyStarterCharacters() {
  if (typeof window === 'undefined') return;
  if (getStoredItem(STARTER_DATA_CLEANUP_KEY)) return;
  const existing = await getAll<DoodleCharacter>(CHARACTER_STORE);
  await Promise.all(existing
    .filter((character) => LEGACY_STARTER_CHARACTER_IDS.includes(character.id) && !character.generatedDataUrl && !character.originalDataUrl)
    .map((character) => removeByKey(CHARACTER_STORE, character.id)));
  setStoredItem(STARTER_DATA_CLEANUP_KEY, '1');
}

function openDb() {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CHARACTER_STORE)) {
          db.createObjectStore(CHARACTER_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
          const store = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
          store.createIndex('characterId', 'characterId');
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  return dbPromise;
}

async function getAll<T>(storeName: string) {
  if (!hasIndexedDb()) return getFallbackStore<T>(storeName);
  const db = await openDb();
  return requestToPromise<T[]>(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
}

async function getByKey<T>(storeName: string, key: IDBValidKey) {
  if (!hasIndexedDb()) {
    return getFallbackStore<T & { id: IDBValidKey }>(storeName).find((item) => item.id === key) as T | undefined;
  }
  const db = await openDb();
  return requestToPromise<T | undefined>(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
}

async function put<T>(storeName: string, value: T) {
  if (!hasIndexedDb()) {
    putFallbackStore(storeName, value as T & { id: IDBValidKey });
    return (value as T & { id: IDBValidKey }).id;
  }
  const db = await openDb();
  return requestToPromise<IDBValidKey>(db.transaction(storeName, 'readwrite').objectStore(storeName).put(value));
}

async function removeByKey(storeName: string, key: IDBValidKey) {
  if (!hasIndexedDb()) {
    const items = getFallbackStore<Array<{ id: IDBValidKey }>[number]>(storeName).filter((item) => item.id !== key);
    setStoredItem(fallbackKey(storeName), JSON.stringify(items));
    return;
  }
  const db = await openDb();
  return requestToPromise<undefined>(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key));
}

function hasIndexedDb() {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

function normalizeSettings(settings: AdvancedSettings): AdvancedSettings {
  return {
    ...settings,
    imageProvider: 'custom',
    customImageEndpoint: normalizeEndpointValue(settings.customImageEndpoint),
  };
}

function normalizeEndpointValue(value: string) {
  if (LEGACY_PLACEHOLDER_ENDPOINT_HOSTS.some((host) => value.includes(host))) return '';
  return value;
}

function fallbackKey(storeName: string) {
  return `${FALLBACK_PREFIX}${storeName}`;
}

function getFallbackStore<T>(storeName: string): T[] {
  try {
    return JSON.parse(getStoredItem(fallbackKey(storeName)) || '[]') as T[];
  } catch {
    return [];
  }
}

function putFallbackStore<T extends { id: IDBValidKey }>(storeName: string, value: T) {
  const items = getFallbackStore<T>(storeName);
  const nextValue = stripBlobFields(value);
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) items[index] = nextValue;
  else items.push(nextValue);
  setStoredItem(fallbackKey(storeName), JSON.stringify(items));
}

function stripBlobFields<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Blob ? undefined : item)) as T;
}

export function getStoredItem(key: string) {
  if (typeof window === 'undefined') return null;
  if (memoryStorage.has(key)) return memoryStorage.get(key) ?? null;
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

export function setStoredItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  memoryStorage.set(key, value);
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    return;
  }
}

export function removeStoredItem(key: string) {
  if (typeof window === 'undefined') return;
  memoryStorage.delete(key);
  try {
    window.localStorage?.removeItem(key);
  } catch {
    return;
  }
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deriveStorageKey() {
  const fingerprint = [navigator.userAgent, navigator.language, screen.width, screen.height].join('|');
  const keyMaterial = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(fingerprint), 'PBKDF2', false, ['deriveKey']);
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('doodle-alive-local'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
