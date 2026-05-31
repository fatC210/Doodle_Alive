'use client';

import type { ImageGenerationRequest, ImageGenerationResult } from './types';
export { buildCustomImageRequestBody, normalizeCustomImageEndpoint } from './image-provider';

export async function generateCharacterImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  return generateWithCustomProvider(request);
}

export async function testImageProviderResponse(request: ImageGenerationRequest): Promise<boolean> {
  if (!request.apiKey || !request.endpoint || !request.model) return false;

  try {
    const response = await fetch('/api/image-generation', buildProxyRequest(request));
    if (!response.ok) return false;
    const result = await response.json().catch(() => null) as ImageGenerationResult | null;
    return Boolean(result?.imageDataUrl || result?.imageUrl);
  } catch {
    return false;
  }
}

async function generateWithCustomProvider(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  if (!request.endpoint) throw new Error('Image generation request URL is missing.');
  if (!request.model) throw new Error('Image generation model name is missing.');
  if (!request.apiKey) throw new Error('Image generation API key is missing.');
  const response = await fetch('/api/image-generation', buildProxyRequest(request));
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return await response.json() as ImageGenerationResult;
}

function buildProxyRequest(request: ImageGenerationRequest): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  };
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json() as { error?: string };
    if (data.error) return data.error;
  } catch {
    const text = await response.text().catch(() => '');
    if (text) return text;
  }
  return `Provider request failed: ${response.status}`;
}
