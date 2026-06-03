import { NextRequest, NextResponse } from 'next/server';
import {
  buildChatCompletionsImageRequestBody,
  buildCustomImageEditEndpoint,
  buildCustomImageRequestBody,
  buildResponsesImageEndpoint,
  buildResponsesImageRequestBody,
  extractImageDataUrl,
  extractImageUrl,
  normalizeCustomImageEndpoint,
  supportsResponsesImageTool,
  usesChatCompletionsForImages,
} from '@/lib/image-provider';
import type { ImageGenerationRequest } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let payload: ImageGenerationRequest;

  try {
    payload = await request.json() as ImageGenerationRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid image generation request.' }, { status: 400 });
  }

  const endpoint = normalizeCustomImageEndpoint(payload.endpoint || '', payload.model);
  if (!endpoint) return NextResponse.json({ error: 'Image generation request URL is missing.' }, { status: 400 });
  if (!isHttpUrl(endpoint)) return NextResponse.json({ error: 'Image generation request URL must start with http:// or https://.' }, { status: 400 });
  if (!payload.model) return NextResponse.json({ error: 'Image generation model name is missing.' }, { status: 400 });
  if (!payload.apiKey) return NextResponse.json({ error: 'Image generation API key is missing.' }, { status: 400 });

  try {
    const primaryRequest = await buildPrimaryProviderRequest(endpoint, payload);
    let providerResponse = await fetch(primaryRequest.endpoint, primaryRequest.init);
    let responseEndpoint = primaryRequest.endpoint;

    if (!providerResponse.ok) {
      const imageApiError = await readProviderError(providerResponse);
      warnProviderFailure(primaryRequest.stage, primaryRequest.endpoint, payload.model, imageApiError);

      if (shouldTryResponsesFallback(payload.model, providerResponse.status, imageApiError)) {
        const responsesEndpoint = buildResponsesImageEndpoint(endpoint);
        if (responsesEndpoint && responsesEndpoint !== endpoint) {
          console.info('[image-generation] trying responses fallback', safeProviderDiagnostic('responses-api', responsesEndpoint, payload.model));
          providerResponse = await fetch(
            responsesEndpoint,
            buildJsonProviderRequest(payload, buildResponsesImageRequestBody(payload)),
          );
          responseEndpoint = responsesEndpoint;
        }
      }

      if (!providerResponse.ok) {
        const isPrimaryResponse = responseEndpoint === primaryRequest.endpoint;
        const fallbackError = isPrimaryResponse ? imageApiError : await readProviderError(providerResponse);
        warnProviderFailure(isPrimaryResponse ? primaryRequest.stage : 'responses-api', responseEndpoint, payload.model, fallbackError);
        throw new Error(fallbackError);
      }
    }

    const data = await readJsonResponse(providerResponse);
    const imageUrl = extractImageUrl(data);
    const extractedDataUrl = extractImageDataUrl(data);
    let imageDataUrl = extractedDataUrl;
    let imageDataUrlWarning = '';

    if (!imageDataUrl && imageUrl) {
      try {
        imageDataUrl = await remoteImageToDataUrl(imageUrl);
      } catch (caught) {
        imageDataUrlWarning = caught instanceof Error ? caught.message : 'Provider image URL could not be downloaded.';
      }
    }

    if (!imageDataUrl && !imageUrl) {
      return NextResponse.json({ error: 'OpenAI-compatible image response did not include an image URL or base64 image.' }, { status: 502 });
    }

    return NextResponse.json({
      imageUrl,
      imageDataUrl,
      warning: imageDataUrlWarning,
      provider: 'custom',
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Image generation failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function fetchWithStatusCheck(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await readProviderError(response));
  return response;
}

function buildJsonProviderRequest(payload: ImageGenerationRequest, body: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body,
  };
}

function buildMultipartProviderRequest(payload: ImageGenerationRequest, body: FormData): RequestInit {
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
    },
    body,
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Image generation provider returned non-JSON response: ${text.slice(0, 240)}`);
  }
}

async function remoteImageToDataUrl(url: string) {
  if (!isHttpUrl(url)) throw new Error('Provider returned an invalid image URL.');
  const response = await fetchWithStatusCheck(url, {});
  const contentType = response.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) throw new Error('Provider returned an invalid image URL.');
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

async function readProviderError(response: Response) {
  const text = await response.text().catch(() => '');
  const statusLabel = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  if (!text) return `Image generation provider rejected the request (${statusLabel}).`;

  let message = text;

  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const error = data.error;
    if (typeof error === 'string') message = error;
    if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
      message = String((error as Record<string, unknown>).message);
    }
    if (typeof data.message === 'string') message = data.message;
  } catch {
    message = text;
  }

  return `Image generation provider rejected the request (${statusLabel}): ${friendlyProviderMessage(message).slice(0, 240)}`;
}

async function buildPrimaryProviderRequest(endpoint: string, payload: ImageGenerationRequest) {
  if (usesChatCompletionsForImages(payload.model)) {
    return {
      endpoint,
      init: buildJsonProviderRequest(payload, buildChatCompletionsImageRequestBody(payload)),
      stage: 'chat-completions-api',
    };
  }

  if (payload.sourceImageDataUrl) {
    return {
      endpoint: buildCustomImageEditEndpoint(endpoint),
      init: buildMultipartProviderRequest(payload, buildCustomImageEditFormData(payload)),
      stage: 'image-edit-api',
    };
  }

  return {
    endpoint,
    init: buildJsonProviderRequest(payload, buildCustomImageRequestBody(payload)),
    stage: 'image-api',
  };
}

function buildCustomImageEditFormData(payload: ImageGenerationRequest) {
  const sourceImage = dataUrlToImageBlob(payload.sourceImageDataUrl || '');
  const formData = new FormData();
  formData.append('model', payload.model || '');
  formData.append('prompt', payload.prompt);
  formData.append('size', '1024x1024');
  formData.append('n', '1');
  formData.append('image', sourceImage.blob, sourceImage.filename);

  if (normalizeModelFamily(payload.model).startsWith('gpt-image-')) {
    formData.append('output_format', 'png');
    formData.append('quality', 'medium');
  } else {
    formData.append('response_format', 'b64_json');
  }

  return formData;
}

function dataUrlToImageBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error('Invalid source drawing image data.');
  const contentType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.replace('image/', '');
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  return {
    blob: new Blob([bytes], { type: contentType }),
    filename: `source-drawing.${extension}`,
  };
}

function normalizeModelFamily(model = '') {
  const normalized = model.trim().toLowerCase();
  return normalized.split('/').pop() || normalized;
}

function friendlyProviderMessage(message: string) {
  if (/no available channel/i.test(message)) {
    return `${message}。上游账号分组没有这个模型的可用渠道，请在模型广场确认模型可用，或改用已开通渠道的图像模型。`;
  }
  if (/no available compatible accounts/i.test(message)) {
    return `${message}。上游当前没有可用兼容账号，请稍后重试，或在模型广场切换到有可用账号的图像模型。`;
  }
  if (/model_not_found/i.test(message)) {
    return `${message}。请检查模型名是否与模型广场完全一致。`;
  }
  return message;
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function shouldTryResponsesFallback(model: string | undefined, status: number, message: string) {
  if (!supportsResponsesImageTool(model)) return false;
  return [404, 405].includes(status) || /no available compatible accounts/i.test(message);
}

function warnProviderFailure(stage: string, endpoint: string, model: string | undefined, error: string) {
  console.warn('[image-generation] provider failure', {
    ...safeProviderDiagnostic(stage, endpoint, model),
    error: error.slice(0, 500),
  });
}

function safeProviderDiagnostic(stage: string, endpoint: string, model: string | undefined) {
  try {
    const url = new URL(endpoint);
    return {
      stage,
      model,
      endpointHost: url.host,
      endpointPath: url.pathname,
    };
  } catch {
    return { stage, model, endpointHost: '', endpointPath: '' };
  }
}
