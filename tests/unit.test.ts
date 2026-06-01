import { describe, expect, test } from 'bun:test';
import { generateRandomCharacterName } from '../lib/character-name';
import { getCustomChatConfigIssues, getMorphingConfigIssues, getPersonaConfigIssues } from '../lib/config-requirements';
import { generateCharacterReply } from '../lib/conversation';
import { defaultSettings, elevenBuiltInModels } from '../lib/data';
import { createElevenAgent, testElevenLabsKey } from '../lib/elevenlabs';
import { canMove, getCreationResumePath, nextStep, previousStep } from '../lib/flow';
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

  test('resumes the creation route from the latest restorable draft step', () => {
    expect(getCreationResumePath({ step: 'STYLE', originalDataUrl: 'data:image/png;base64,drawing' })).toBe('/create/style');
    expect(getCreationResumePath({ step: 'MORPHING', originalDataUrl: 'data:image/png;base64,drawing' })).toBe('/create/morph');
    expect(getCreationResumePath({ step: 'PERSONA', generatedDataUrl: 'data:image/png;base64,character' })).toBe('/create/persona');
    expect(getCreationResumePath({ step: 'STYLE' })).toBeNull();
    expect(getCreationResumePath({ step: 'DRAW' })).toBeNull();
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
    expect(getCustomChatConfigIssues(defaultSettings, '')).toEqual([]);
    expect(getCustomChatConfigIssues({ ...defaultSettings, llmSource: 'custom' }, '')).toEqual([
      'customLlmModel',
      'customLlmEndpoint',
      'customLlmKey',
    ]);
  });

  test('exposes the broader ElevenLabs built-in model list', () => {
    const modelIds = elevenBuiltInModels.map((model) => model.id);
    expect(modelIds).toContain('gpt-4.1');
    expect(modelIds).toContain('gpt-5');
    expect(modelIds).toContain('claude-sonnet-4-5');
    expect(modelIds).toContain('gemini-3-pro-preview');
    expect(modelIds).toContain('gpt-oss-120b');
  });
});

describe('character naming', () => {
  test('generates random display names for each language', () => {
    const englishValues = [0, 0.99];
    const chineseValues = [0.99, 0];

    expect(generateRandomCharacterName('en', () => englishValues.shift() ?? 0)).toBe('Sunny Bubbles');
    expect(generateRandomCharacterName('zh', () => chineseValues.shift() ?? 0)).toBe('暖暖涂涂');
  });
});

describe('prompt assembly', () => {
  test('includes D-ID-friendly real face constraints and child safety constraints', () => {
    const prompt = buildImagePrompt('pixar-3d', ['#ff0000', '#00ff00'], '#ffffff');
    expect(prompt).toContain('frontal facing portrait');
    expect(prompt).toContain('D-ID compatible real person portrait');
    expect(prompt).toContain('photorealistic human face');
    expect(prompt).toContain('natural realistic skin texture');
    expect(prompt).toContain('closed mouth');
    expect(prompt).toContain('open eyes');
    expect(prompt).toContain('kid-friendly friendly person portrait');
    expect(prompt).toContain('not a cartoon avatar');
    expect(prompt).toContain('#ff0000, #00ff00');
  });

  test('uses selected style and random human face instructions for blank canvas', () => {
    const prompt = buildImagePrompt('anime', [], '#ffffff', { isBlankCanvas: true });
    expect(prompt).toContain('Japanese anime style');
    expect(prompt).toContain('random friendly real human face');
    expect(prompt).not.toContain('provided original image');
  });

  test('asks non-blank drawings to become realistic human face portraits in the selected style', () => {
    const prompt = buildImagePrompt('watercolor', ['#2176d8'], '#ffffff');
    expect(prompt).toContain('Watercolor painting style');
    expect(prompt).toContain('transform the provided original image into a real human face portrait');
    expect(prompt).toContain('preserve the original image colors, shapes, mood, and character idea');
    expect(prompt).toContain('D-ID compatible real person portrait');
  });

  test('keeps the selected canvas background color out of generation constraints', () => {
    const prompt = buildImagePrompt('watercolor', ['#2176d8'], '#ffdce8');
    expect(prompt).toContain('solid clean white background');
    expect(prompt).not.toContain('#ffdce8');
    expect(prompt).not.toContain('selected canvas background color');
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

describe('ElevenLabs built-in agent chat', () => {
  test('creates text-only agents with the selected built-in LLM', async () => {
    let requestBody = '';
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: async (_url: string, init: RequestInit) => {
        requestBody = String(init.body);
        return {
          ok: true,
          json: async () => ({ agent_id: 'agent-1' }),
        };
      },
    });

    try {
      await createElevenAgent({
        apiKey: 'eleven-key',
        persona: {
          id: 'gentle-guardian',
          name: 'Gentle Guardian',
          nameZh: '温柔守护者',
          desc: '',
          voice: '',
          voiceZh: '',
          voiceId: 'voice-1',
          icon: '💗',
          tone: 'blue',
          systemPrompt: 'Be kind.',
        },
        character: { name: 'Lumi', styleName: 'Watercolor', prompt: '' },
        llmSource: 'built-in',
        model: 'gpt-4o-mini',
      });

      const payload = JSON.parse(requestBody);
      expect(payload.conversation_config.agent.prompt.llm).toBe('gpt-4o-mini');
      expect(payload.conversation_config.conversation.text_only).toBe(true);
      expect(payload.conversation_config.conversation.client_events).toContain('agent_response');
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
    }
  });

  test('validates ElevenLabs keys using HTTP status', async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: async () => ({ ok: false }),
    });

    try {
      expect(await testElevenLabsKey('bad-key')).toBe(false);
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
