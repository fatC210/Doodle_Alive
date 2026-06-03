import type { ImageGenerationRequest } from './types';

const URL_KEYS = ['url', 'image_url', 'imageUrl', 'image_url_signed', 'signed_url'];
const BASE64_KEYS = ['b64_json', 'image_base64', 'base64', 'imageBase64', 'result'];
const TEXT_KEYS = ['content', 'text'];

export function buildCustomImageRequestBody(request: ImageGenerationRequest) {
  const normalizedModel = normalizeModelFamily(request.model);
  const isGptImageModel = normalizedModel.startsWith('gpt-image-');
  const body: Record<string, unknown> = {
    model: request.model || '',
    prompt: request.prompt,
    size: '1024x1024',
    n: 1,
  };

  if (isGptImageModel) {
    body.output_format = 'png';
    body.quality = 'medium';
  } else {
    body.response_format = 'b64_json';
  }

  return JSON.stringify(body);
}

export function buildCustomImageEditJsonRequestBody(request: ImageGenerationRequest) {
  const normalizedModel = normalizeModelFamily(request.model);
  const isGptImageModel = normalizedModel.startsWith('gpt-image-');
  const body: Record<string, unknown> = {
    model: request.model || '',
    prompt: request.prompt,
    image: request.sourceImageDataUrl || '',
    size: '1024x1024',
    n: 1,
  };

  if (isGptImageModel) {
    body.quality = 'medium';
  } else {
    body.response_format = 'b64_json';
  }

  return JSON.stringify(body);
}

export function buildResponsesImageRequestBody(request: ImageGenerationRequest) {
  const input = request.sourceImageDataUrl
    ? [{
      role: 'user',
      content: [
        { type: 'input_text', text: request.prompt },
        { type: 'input_image', image_url: request.sourceImageDataUrl },
      ],
    }]
    : request.prompt;

  return JSON.stringify({
    model: request.model || '',
    input,
    tools: [{ type: 'image_generation' }],
  });
}

export function buildChatCompletionsImageRequestBody(request: ImageGenerationRequest) {
  const content = request.sourceImageDataUrl
    ? [
      { type: 'text', text: request.prompt },
      { type: 'image_url', image_url: { url: request.sourceImageDataUrl } },
    ]
    : request.prompt;

  return JSON.stringify({
    model: request.model || '',
    messages: [{ role: 'user', content }],
  });
}

export function buildResponsesImageEndpoint(imageEndpoint: string) {
  const baseEndpoint = normalizeCustomImageBaseEndpoint(imageEndpoint);
  return baseEndpoint ? `${baseEndpoint}/responses` : '';
}

export function buildCustomImageEditEndpoint(imageEndpoint: string) {
  const trimmed = imageEndpoint.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (/\/images\/edits$/i.test(pathname)) return url.toString();
    if (/\/images\/generations$/i.test(pathname)) {
      url.pathname = pathname.replace(/\/images\/generations$/i, '/images/edits');
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function supportsResponsesImageTool(model = '') {
  const normalizedModel = normalizeModelFamily(model);
  return !!normalizedModel && !normalizedModel.startsWith('gpt-image-') && !normalizedModel.startsWith('dall-e');
}

export function usesChatCompletionsForImages(model = '') {
  const normalizedModel = normalizeModelFamily(model);
  return normalizedModel.startsWith('gemini-') && normalizedModel.includes('image');
}

export function usesJsonImageEditPayload(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.host === 'router.shengsuanyun.com' && /\/images\/edits$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizeModelFamily(model = '') {
  const normalized = model.trim().toLowerCase();
  return normalized.split('/').pop() || normalized;
}

export function normalizeCustomImageEndpoint(endpoint: string, model = '') {
  if (usesChatCompletionsForImages(model)) return normalizeCustomChatCompletionsEndpoint(endpoint);
  const trimmed = endpoint.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) {
      url.pathname = '/v1/images/generations';
      return url.toString();
    }
    if (/\/api$/i.test(pathname)) {
      url.pathname = `${pathname}/v1/images/generations`;
      return url.toString();
    }
    if (/\/(?:api\/)?v1$/i.test(pathname)) {
      url.pathname = `${pathname}/images/generations`;
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function normalizeCustomChatCompletionsEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname) {
      url.pathname = '/v1/chat/completions';
      return url.toString();
    }
    if (/\/(?:api\/)?v1$/i.test(pathname)) {
      url.pathname = `${pathname}/chat/completions`;
      return url.toString();
    }
    if (/\/images\/generations$/i.test(pathname)) {
      url.pathname = pathname.replace(/\/images\/generations$/i, '/chat/completions');
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function normalizeCustomImageBaseEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed
    .replace(/\/images\/generations$/i, '')
    .replace(/\/images\/edits$/i, '')
    .replace(/\/responses$/i, '');
}

export function extractImageUrl(input: unknown) {
  const value = findImageValue(input, URL_KEYS, isHttpImageUrl);
  return value && isHttpImageUrl(value) ? value : '';
}

export function extractImageDataUrl(input: unknown) {
  const embeddedDataUrl = findDataImageUrl(input);
  if (embeddedDataUrl) return embeddedDataUrl;

  const dataUrl = findImageValue(input, ['image'], isDataImageUrl);
  if (dataUrl) return dataUrl;

  const base64 = findImageValue(input, BASE64_KEYS, isBase64ImageLike) || findArrayString(input, isBase64ImageLike);
  if (!base64) return '';
  if (base64.startsWith('data:image/')) return base64;
  return `data:image/png;base64,${base64}`;
}

function findDataImageUrl(input: unknown): string {
  if (typeof input === 'string') {
    const match = input.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/i);
    return match ? match[0].replace(/\s+/g, '') : '';
  }
  if (!input || typeof input !== 'object') return '';

  if (Array.isArray(input)) {
    for (const item of input) {
      const value = findDataImageUrl(item);
      if (value) return value;
    }
    return '';
  }

  const data = input as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const value = findDataImageUrl(data[key]);
    if (value) return value;
  }
  for (const key of ['choices', 'message', 'data', 'images', 'image', 'output', 'result', 'results', 'artifacts']) {
    const value = findDataImageUrl(data[key]);
    if (value) return value;
  }
  return '';
}

function findImageValue(input: unknown, keys: string[], accept: (value: string) => boolean): string {
  if (typeof input === 'string') return accept(input) ? input : '';
  if (!input || typeof input !== 'object') return '';

  if (Array.isArray(input)) {
    for (const item of input) {
      const value = findImageValue(item, keys, accept);
      if (value) return value;
    }
    return '';
  }

  const data = input as Record<string, unknown>;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && accept(value)) return value;
  }

  const likelyContainers = ['data', 'images', 'image', 'output', 'result', 'results', 'artifacts'];
  for (const key of likelyContainers) {
    const value = findImageValue(data[key], keys, accept);
    if (value) return value;
  }

  return '';
}

function findArrayString(input: unknown, accept: (value: string) => boolean): string {
  if (!input || typeof input !== 'object') return '';
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string' && accept(item)) return item;
      const value = findArrayString(item, accept);
      if (value) return value;
    }
    return '';
  }

  const data = input as Record<string, unknown>;
  for (const key of ['data', 'images', 'image', 'output', 'result', 'results', 'artifacts']) {
    const value = findArrayString(data[key], accept);
    if (value) return value;
  }
  return '';
}

function isHttpImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isDataImageUrl(value: string) {
  return value.startsWith('data:image/');
}

function isBase64ImageLike(value: string) {
  const trimmed = value.trim();
  if (isDataImageUrl(trimmed)) return true;
  if (isHttpImageUrl(trimmed)) return false;
  if (trimmed.length < 80) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed);
}
