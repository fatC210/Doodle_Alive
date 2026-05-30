'use client';

import type { ImageGenerationRequest, ImageGenerationResult } from './types';

export async function generateCharacterImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const timeoutMs = request.timeoutMs ?? 30000;
  return generateWithCustomProvider(request, timeoutMs);
}

export async function testImageProviderResponse(request: ImageGenerationRequest): Promise<boolean> {
  if (!request.apiKey || !request.endpoint || !request.model) return false;
  const timeoutMs = request.timeoutMs ?? 15000;

  try {
    const body = buildCustomImageRequestBody(request);
    const response = await fetchAnyResponse(request.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.apiKey}`,
      },
      body,
    }, timeoutMs);
    return response.ok;
  } catch {
    return false;
  }
}

async function generateWithCustomProvider(request: ImageGenerationRequest, timeoutMs: number): Promise<ImageGenerationResult> {
  if (!request.endpoint) throw new Error('Image generation request URL is missing.');
  if (!request.model) throw new Error('Image generation model name is missing.');
  if (!request.apiKey) throw new Error('Image generation API key is missing.');
  const body = buildCustomImageRequestBody(request);
  const response = await fetchWithTimeout(request.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
    },
    body,
  }, timeoutMs);
  const data = await response.json();
  const imageUrl = extractImageUrl(data);
  if (!imageUrl) throw new Error('OpenAI-compatible image response did not include a public image URL.');
  return { imageUrl, blob: await remoteImageToBlob(imageUrl), provider: 'custom' };
}

export function buildCustomImageRequestBody(request: ImageGenerationRequest) {
  return JSON.stringify({
    model: request.model || '',
    prompt: request.prompt,
    size: '1024x1024',
    n: 1,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Provider request failed: ${response.status}`);
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAnyResponse(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function remoteImageToBlob(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Provider returned an invalid image URL.');
  return blob;
}

function extractImageUrl(input: unknown) {
  if (!input || typeof input !== 'object') return '';
  const data = input as Record<string, unknown>;
  const firstDataItem = Array.isArray(data.data) ? data.data[0] : undefined;
  if (typeof firstDataItem === 'string') return firstDataItem;
  if (firstDataItem && typeof firstDataItem === 'object') {
    const first = firstDataItem as Record<string, unknown>;
    if (typeof first.url === 'string') return first.url;
    if (typeof first.image_url === 'string') return first.image_url;
  }
  if (typeof data.url === 'string') return data.url;
  if (typeof data.image_url === 'string') return data.image_url;
  return '';
}
