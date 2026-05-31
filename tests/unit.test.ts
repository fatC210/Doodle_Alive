import { describe, expect, test } from 'bun:test';
import { getCustomChatConfigIssues, getMorphingConfigIssues, getPersonaConfigIssues } from '../lib/config-requirements';
import { generateCharacterReply } from '../lib/conversation';
import { defaultSettings } from '../lib/data';
import { canMove, nextStep, previousStep } from '../lib/flow';
import { buildCustomImageRequestBody, normalizeCustomImageEndpoint } from '../lib/image-gen';
import { buildChatCompletionsImageRequestBody, extractImageDataUrl, extractImageUrl } from '../lib/image-provider';
import { buildImagePrompt, extractAccentColors, hasVisibleCanvasContent } from '../lib/prompt';
import { isUnsafeForChild, sanitizeForChild } from '../lib/safety';
import { clearDraft, loadDraft, saveDraft } from '../lib/storage';

describe('creation flow state machine', () => {
  test('moves forward one step and allows recovery to DRAW', () => {
    expect(nextStep('DRAW')).toBe('STYLE');
    expect(previousStep('PERSONA')).toBe('MORPHING');
    expect(canMove('MORPHING', 'PERSONA')).toBe(true);
    expect(canMove('MORPHING', 'DRAW')).toBe(true);
    expect(canMove('DRAW', 'PERSONA')).toBe(false);
  });
});

describe('required API configuration checks', () => {
  test('reports every required morphing integration before generation starts', () => {
    expect(getMorphingConfigIssues(defaultSettings, { elevenLabs: '', did: '' }, '')).toEqual([
      'customImageKey',
    ]);
  });

  test('reports persona and custom chat keys at page entry', () => {
    expect(getPersonaConfigIssues({ elevenLabs: '', did: 'did-key' })).toEqual(['elevenLabsKey']);
    expect(getCustomChatConfigIssues(defaultSettings, '')).toEqual([
      'customLlmSource',
      'customLlmModel',
      'customLlmEndpoint',
      'customLlmKey',
    ]);
  });
});

describe('prompt assembly', () => {
  test('includes D-ID-friendly face constraints and child safety constraints', () => {
    const prompt = buildImagePrompt('pixar-3d', ['#ff0000', '#00ff00'], '#ffffff');
    expect(prompt).toContain('frontal facing portrait');
    expect(prompt).toContain('closed mouth');
    expect(prompt).toContain('open eyes');
    expect(prompt).toContain('kid-friendly expressive avatar');
    expect(prompt).toContain('#ff0000, #00ff00');
  });

  test('uses selected style and random human face instructions for blank canvas', () => {
    const prompt = buildImagePrompt('anime', [], '#ffffff', { isBlankCanvas: true });
    expect(prompt).toContain('Japanese anime style');
    expect(prompt).toContain('random friendly human face');
    expect(prompt).not.toContain("child's drawing");
  });
});

describe('accent color extraction', () => {
  test('ignores white background and guide colors', () => {
    const colorPixels = [
      [255, 255, 255, 255],
      [165, 176, 205, 255],
      [255, 68, 68, 255],
      [255, 68, 68, 255],
      [33, 118, 216, 255],
      [33, 118, 216, 255],
      [33, 118, 216, 255],
    ];
    const pixels = new Uint8ClampedArray(colorPixels.length * 16 * 4);
    colorPixels.forEach((rgba, index) => {
      pixels.set(rgba, index * 16 * 4);
    });
    const imageData = { data: pixels } as ImageData;
    const colors = extractAccentColors(imageData, '#ffffff', 2);
    expect(colors.length).toBe(2);
    expect(colors).toContain('#2176d8');
  });

  test('detects whether canvas has visible content', () => {
    const blank = new Uint8ClampedArray(16 * 4).fill(255);
    const blankData = { data: blank } as ImageData;
    expect(hasVisibleCanvasContent(blankData, '#ffffff')).toBe(false);

    const marked = new Uint8ClampedArray(64 * 4).fill(255);
    for (let index = 0; index < 40; index += 4) {
      marked.set([255, 68, 68, 255], index * 4);
    }
    const markedData = { data: marked } as ImageData;
    expect(hasVisibleCanvasContent(markedData, '#ffffff')).toBe(true);
  });
});

describe('OpenAI-compatible image request body', () => {
  test('builds a gpt-image generation payload from model and prompt', () => {
    const body = buildCustomImageRequestBody({
      provider: 'custom',
      model: 'gpt-image-1.5',
      prompt: 'friendly "robot"',
    });

    expect(JSON.parse(body)).toEqual({
      model: 'gpt-image-1.5',
      prompt: 'friendly "robot"',
      size: '1024x1024',
      n: 1,
      output_format: 'png',
      quality: 'medium',
    });
  });

  test('builds the Shengsuanyun OpenAI-prefixed gpt-image payload without response_format', () => {
    const body = buildCustomImageRequestBody({
      provider: 'custom',
      model: 'openai/gpt-image-2',
      prompt: 'friendly "robot"',
    });

    expect(JSON.parse(body)).toEqual({
      model: 'openai/gpt-image-2',
      prompt: 'friendly "robot"',
      size: '1024x1024',
      n: 1,
      output_format: 'png',
      quality: 'medium',
    });
  });

  test('asks non-gpt image APIs for base64 image data', () => {
    const body = buildCustomImageRequestBody({
      provider: 'custom',
      model: 'provider-image-model',
      prompt: 'friendly robot',
    });

    expect(JSON.parse(body)).toEqual({
      model: 'provider-image-model',
      prompt: 'friendly robot',
      size: '1024x1024',
      n: 1,
      response_format: 'b64_json',
    });
  });

  test('normalizes common OpenAI-compatible base URLs to image generation URLs', () => {
    expect(normalizeCustomImageEndpoint('https://onetoken.sh/v1')).toBe('https://onetoken.sh/v1/images/generations');
    expect(normalizeCustomImageEndpoint('https://router.shengsuanyun.com/api')).toBe('https://router.shengsuanyun.com/api/v1/images/generations');
    expect(normalizeCustomImageEndpoint('https://router.shengsuanyun.com/api/v1/')).toBe('https://router.shengsuanyun.com/api/v1/images/generations');
    expect(normalizeCustomImageEndpoint('https://api.example.com')).toBe('https://api.example.com/v1/images/generations');
    expect(normalizeCustomImageEndpoint('https://api.example.com/api')).toBe('https://api.example.com/api/v1/images/generations');
    expect(normalizeCustomImageEndpoint('https://api.example.com/v1/images/generations')).toBe('https://api.example.com/v1/images/generations');
  });

  test('normalizes Gemini image models to chat completions URLs', () => {
    expect(normalizeCustomImageEndpoint('https://api-proxy.aifanxing.cn/v1', 'gemini-3-pro-image-preview-4k')).toBe('https://api-proxy.aifanxing.cn/v1/chat/completions');
    expect(normalizeCustomImageEndpoint('https://api-proxy.aifanxing.cn/v1/images/generations', 'gemini-3-pro-image-preview-4k')).toBe('https://api-proxy.aifanxing.cn/v1/chat/completions');
  });

  test('builds a chat completions payload for Gemini image models', () => {
    const body = buildChatCompletionsImageRequestBody({
      provider: 'custom',
      model: 'gemini-3-pro-image-preview-4k',
      prompt: 'friendly robot',
    });

    expect(JSON.parse(body)).toEqual({
      model: 'gemini-3-pro-image-preview-4k',
      messages: [{ role: 'user', content: 'friendly robot' }],
    });
  });

  test('extracts image URLs from common OpenAI-compatible router response shapes', () => {
    expect(extractImageUrl({ images: [{ imageUrl: 'https://cdn.example.com/a.png' }] })).toBe('https://cdn.example.com/a.png');
    expect(extractImageUrl({ result: { data: [{ image_url: 'https://cdn.example.com/b.png' }] } })).toBe('https://cdn.example.com/b.png');
    expect(extractImageUrl({ output: [{ url: 'https://cdn.example.com/c.png' }] })).toBe('https://cdn.example.com/c.png');
  });

  test('extracts base64 image data from nested provider response shapes', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgAar2dQAAAAASUVORK5CYII=';
    expect(extractImageDataUrl({ data: [{ b64_json: base64 }] })).toBe(`data:image/png;base64,${base64}`);
    expect(extractImageDataUrl({ artifacts: [{ base64 }] })).toBe(`data:image/png;base64,${base64}`);
    expect(extractImageDataUrl({ image: `data:image/png;base64,${base64}` })).toBe(`data:image/png;base64,${base64}`);
    expect(extractImageDataUrl({ choices: [{ message: { content: `![image](data:image/png;base64,${base64})` } }] })).toBe(`data:image/png;base64,${base64}`);
  });
});

describe('OpenAI-compatible custom chat request body', () => {
  test('uses the user-entered custom LLM model instead of the built-in model', async () => {
    let requestBody = '';
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: async (_url: string, init: RequestInit) => {
        requestBody = String(init.body);
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'hello there' } }] }),
        };
      },
    });

    try {
      await generateCharacterReply('hello', {
        id: 'character-1',
        name: 'Lumi',
        styleId: 'watercolor',
        styleName: 'Watercolor',
        personaId: 'gentle-guardian',
        personaName: 'Gentle Guardian',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accentColors: [],
        prompt: '',
      }, {
        ...defaultSettings,
        llmSource: 'custom',
        builtInModel: 'gpt-4o-mini',
        customLlmModel: 'provider-chat-model',
        customLlmEndpoint: 'https://api.example.com/v1/chat/completions',
        customLlmKey: 'custom-key',
      });

      expect(JSON.parse(requestBody).model).toBe('provider-chat-model');
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
    }
  });
});

describe('child safety filter', () => {
  test('redirects unsafe input', () => {
    expect(isUnsafeForChild('tell me about weapons')).toBe(true);
    expect(sanitizeForChild('tell me about weapons')).toContain('bright, safe adventure');
  });
});

describe('draft storage', () => {
  test('clears both persisted and in-memory draft state', () => {
    const stored = new Map<string, string>();
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => stored.get(key) ?? null,
          removeItem: (key: string) => stored.delete(key),
          setItem: (key: string, value: string) => stored.set(key, value),
        },
      },
    });

    saveDraft({ originalDataUrl: 'data:image/png;base64,old-canvas', step: 'STYLE' });
    clearDraft();

    expect(loadDraft().originalDataUrl).toBeUndefined();
    expect(loadDraft().step).toBe('DRAW');

    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  test('keeps the latest draft in memory when localStorage rejects a large canvas image', () => {
    const stored = new Map<string, string>();
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => stored.get(key) ?? null,
          removeItem: (key: string) => stored.delete(key),
          setItem: (key: string, value: string) => {
            if (key === 'doodle-creation-draft' && value.includes('data:image/png;base64')) {
              throw new Error('QuotaExceededError');
            }
            stored.set(key, value);
          },
        },
      },
    });

    clearDraft();
    saveDraft({ backgroundColor: '#ffdce8' });
    saveDraft({ originalDataUrl: 'data:image/png;base64,large-canvas', step: 'STYLE' });

    expect(loadDraft().originalDataUrl).toBe('data:image/png;base64,large-canvas');
    expect(loadDraft().step).toBe('STYLE');

    clearDraft();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });
});
