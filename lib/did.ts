import type { DidAvatarResult, ImageProviderType } from './types';

const DID_API_BASE = 'https://api.d-id.com';
const FRIENDLY_FACE_FAILURE = '角色还没准备好，试试画得更清楚或换个风格';

interface CreateDidAvatarInput {
  apiKey: string;
  imageUrl?: string;
  provider: ImageProviderType;
  timeoutMs?: number;
}

export async function createDidAvatar(input: CreateDidAvatarInput): Promise<DidAvatarResult> {
  if (!input.apiKey) {
    return {
      ok: false,
      status: 'failed',
      message: 'D-ID API Key is missing. Please add it in Settings.',
      recoverable: false,
    };
  }

  if (!input.imageUrl || !/^https?:\/\//i.test(input.imageUrl)) {
    return {
      ok: false,
      status: 'failed',
      message: 'D-ID needs a public image URL from the image provider.',
      recoverable: true,
    };
  }

  try {
    const response = await fetchWithTimeout(`${DID_API_BASE}/talks/streams`, {
      method: 'POST',
      headers: didHeaders(input.apiKey),
      body: JSON.stringify({
        source_url: input.imageUrl,
        config: {
          stitch: true,
          result_format: 'mp4',
        },
      }),
    }, input.timeoutMs ?? 30000);

    const data = await response.json();
    const streamId = String(data?.id || data?.stream_id || '');
    if (!streamId) throw new Error('D-ID did not return a streaming resource id.');

    return {
      ok: true,
      avatarId: streamId,
      streamId,
      avatarSourceUrl: input.imageUrl,
      status: 'passed',
      message: 'D-ID face validation passed and streaming resources are ready.',
      recoverable: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FRIENDLY_FACE_FAILURE;
    const faceFailed = /face|detect|source|image|422|400/i.test(message);
    return {
      ok: false,
      status: 'failed',
      message: faceFailed ? FRIENDLY_FACE_FAILURE : `D-ID setup failed: ${message}`,
      recoverable: true,
    };
  }
}

export async function testDidKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await fetch(`${DID_API_BASE}/scenes/avatars`, { headers: didHeaders(apiKey, false) });
    return true;
  } catch {
    return false;
  }
}

export function didHeaders(apiKey: string, includeJson = true): HeadersInit {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Accept: 'application/json',
    Authorization: apiKey.includes(':') ? `Basic ${btoa(apiKey)}` : `Basic ${apiKey}`,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`D-ID request failed: ${response.status} ${text.slice(0, 180)}`);
    }
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}
