import { describe, expect, test } from 'bun:test';
import { generateRandomCharacterName } from '../lib/character-name';
import { getMorphingConfigIssues } from '../lib/config-requirements';
import { defaultSettings, styles } from '../lib/data';
import { canMove, getCreationResumePath, nextStep, previousStep } from '../lib/flow';
import { buildCustomImageRequestBody, normalizeCustomImageEndpoint } from '../lib/image-gen';
import { buildChatCompletionsImageRequestBody, extractImageDataUrl, extractImageUrl } from '../lib/image-provider';
import { buildImagePrompt, extractAccentColors, hasVisibleCanvasContent } from '../lib/prompt';
import { clearDraft, dataUrlToBlob, loadDraft, saveDraft } from '../lib/storage';

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
    expect(getMorphingConfigIssues(defaultSettings, '')).toEqual([
      'customImageKey',
    ]);
  });

});

describe('character naming', () => {
  test('generates random display names for each language', () => {
    const englishValues = [0, 0.99];
    const chineseValues = [0.99, 0];

    expect(generateRandomCharacterName('en', () => englishValues.shift() ?? 0)).toBe('Milo');
    expect(generateRandomCharacterName('zh', () => chineseValues.shift() ?? 0)).toBe('\u6674\u6674');
  });
});

describe('prompt assembly', () => {
  test('keeps only the requested six image styles', () => {
    expect(styles.map((style) => style.nameZh)).toEqual(['美式学院', '柔光棚拍', '儿童', '水彩', '赛博朋克', '奇幻中世纪']);
    expect(styles.map((style) => style.image)).toEqual([
      '/images/styles/美式学院.png',
      '/images/styles/柔光棚拍.png',
      '/images/styles/儿童.png',
      '/images/styles/水彩.png',
      '/images/styles/赛博朋克.png',
      '/images/styles/奇幻中世纪.png',
    ]);
  });

  test('includes D-ID-friendly real frontal face constraints and child safety constraints', () => {
    const prompt = buildImagePrompt('american-academy', ['#ff0000', '#00ff00'], '#ffffff');
    expect(prompt).toContain('convert the image into a real human frontal face portrait in American Academy style');
    expect(prompt).toContain('D-ID compatible real person portrait');
    expect(prompt).toContain('authentic warm campus portrait photography');
    expect(prompt).toContain('natural realistic skin texture');
    expect(prompt).not.toContain('one single human subject');
    expect(prompt).not.toContain('closed mouth');
    expect(prompt).not.toContain('open eyes');
    expect(prompt).not.toContain('solid clean white background');
    expect(prompt).not.toContain('kid-friendly friendly person portrait');
    expect(prompt).toContain('#ff0000, #00ff00');
  });

  test('uses selected style and random human face instructions for blank canvas', () => {
    const prompt = buildImagePrompt('cyberpunk', [], '#ffffff', { isBlankCanvas: true });
    expect(prompt).toContain('Cyberpunk style');
    expect(prompt).toContain('create a real human frontal face portrait in Cyberpunk style');
    expect(prompt).not.toContain('provided original image');
  });

  test('uses black turtleneck and light gray background for soft studio style', () => {
    const prompt = buildImagePrompt('soft-studio', [], '#ffffff');
    expect(prompt).toContain('black turtleneck sweater');
    expect(prompt).toContain('light gray background');
  });

  test('uses real child portrait direction for the former western comic style slot', () => {
    const prompt = buildImagePrompt('western-comic', [], '#ffffff');
    expect(prompt).toContain('Real child portrait photography');
    expect(prompt).toContain('realistic child portrait photography');
    expect(prompt).toContain('natural youthful facial features');
    expect(prompt).toContain('convert the image into a real human frontal face portrait in Children style');
    expect(prompt).not.toContain('Western comic book style');
  });

  test('asks non-blank drawings to become real frontal face portraits in the selected style', () => {
    const prompt = buildImagePrompt('watercolor', ['#2176d8'], '#ffffff');
    expect(prompt).toContain('Depict a frontal portrait of a real person in a watercolor style; the composition should capture the head and shoulders; no text or watermarks.');
    expect(prompt).not.toContain('delicate watercolor portrait on textured paper');
    expect(prompt).toContain('transform the provided original image into a real human frontal face portrait in Watercolor style');
    expect(prompt).toContain('preserve the original image colors, shapes, mood, and character idea');
    expect(prompt).toContain('D-ID compatible real person portrait');
  });

  test('keeps the selected canvas background color out of generation constraints', () => {
    const prompt = buildImagePrompt('watercolor', ['#2176d8'], '#ffdce8');
    expect(prompt).not.toContain('solid clean white background');
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

describe('draft storage', () => {
  test('converts base64 data URLs to typed blobs without fetch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('fetch should not be called'); }) as typeof fetch;

    try {
      const blob = await dataUrlToBlob('data:image/png;base64,SGVsbG8=');

      expect(blob.type).toBe('image/png');
      expect(await blob.text()).toBe('Hello');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('converts percent-encoded data URLs to typed blobs', async () => {
    const blob = await dataUrlToBlob('data:text/plain;charset=utf-8,Hello%20Doodle');

    expect(blob.type).toStartWith('text/plain');
    expect(await blob.text()).toBe('Hello Doodle');
  });

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
