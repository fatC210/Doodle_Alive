import { describe, expect, test } from 'bun:test';
import { generateRandomCharacterName } from '../lib/character-name';
import { getMorphingConfigIssues } from '../lib/config-requirements';
import { defaultSettings, personas, pickRandomPersona, styles } from '../lib/data';
import { buildAgentClientKeyPath, buildAgentPayload, readDidImageUploadUrl, refreshDidAgentClientKey } from '../lib/did-agent-server';
import { canMove, getCreationResumePath, nextStep, previousStep } from '../lib/flow';
import { buildCustomImageRequestBody, normalizeCustomImageEndpoint } from '../lib/image-gen';
import { buildChatCompletionsImageRequestBody, buildCustomImageEditEndpoint, buildCustomImageEditJsonRequestBody, buildResponsesImageRequestBody, extractImageDataUrl, extractImageUrl, usesJsonImageEditPayload } from '../lib/image-provider';
import { buildImagePrompt, extractAccentColors, hasVisibleCanvasContent } from '../lib/prompt';
import { clearDraft, dataUrlToBlob, decryptSecret, encryptSecret, isCurrentSecretCipher, loadDraft, loadSettings, resetSettings, saveDraft, saveSettings } from '../lib/storage';

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
      'customImageEndpoint',
      'customImageModel',
      'customImageKey',
    ]);
  });

  test('treats whitespace-only keys as missing', () => {
    expect(getMorphingConfigIssues(defaultSettings, '   ')).toEqual([
      'customImageEndpoint',
      'customImageModel',
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

describe('D-ID agent payload', () => {
  test('creates client keys through the scoped agent endpoint', () => {
    expect(buildAgentClientKeyPath('v2_agt_example')).toBe('/agents/v2_agt_example/client-keys');
    expect(buildAgentClientKeyPath('agent/id with spaces')).toBe('/agents/agent%2Fid%20with%20spaces/client-keys');
    expect(() => buildAgentClientKeyPath('  ')).toThrow('D-ID Agent id is missing');
  });

  test('refreshes client keys without mutating the agent presenter', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), method: init?.method, body: init?.body });
      return new Response(JSON.stringify({ client_key: 'ck_test' }), { status: 200 });
    }) as typeof fetch;

    try {
      const result = await refreshDidAgentClientKey({
        agentId: 'v2_agt_example',
        apiKey: 'test-key',
        allowedDomains: 'http://localhost:3000',
        sourceUrl: 'https://example.com/avatar.png',
      });

      expect(result).toEqual({ clientKey: 'ck_test' });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        url: 'https://api.d-id.com/agents/v2_agt_example/client-keys',
        method: 'POST',
      });
      expect(String(requests[0].body)).toContain('allowed_domains');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('uses photo avatar presenter with default OpenAI llm provider', () => {
    const payload = buildAgentPayload({ characterName: 'Milo' }, 'https://example.com/milo.png');

    expect(payload.presenter).toMatchObject({
      type: 'talk',
      source_url: 'https://example.com/milo.png',
      thumbnail: 'https://example.com/milo.png',
    });
    expect(payload.llm).toMatchObject({ provider: 'openai', model: 'gpt-4.1-mini' });
  });

  test('uses a browser-loadable poster when D-ID stores the source image internally', () => {
    const dataUrl = 'data:image/png;base64,avatar';
    const payload = buildAgentPayload({ characterName: 'Milo', imageDataUrl: dataUrl }, 's3://d-id-images-prod/user/avatar.png', dataUrl);

    expect(payload.presenter).toMatchObject({
      type: 'talk',
      source_url: 's3://d-id-images-prod/user/avatar.png',
      thumbnail: dataUrl,
    });
  });

  test('prefers public HTTP image upload URLs over internal S3 URLs', () => {
    expect(readDidImageUploadUrl({ url: 's3://d-id-images-prod/internal.png', download_url: 'https://cdn.example.com/avatar.png' })).toBe('https://cdn.example.com/avatar.png');
    expect(readDidImageUploadUrl({ url: 's3://d-id-images-prod/internal.png' })).toBe('s3://d-id-images-prod/internal.png');
  });

  test('localizes D-ID greeting, instructions, and default voice from UI language', () => {
    const originalVoice = process.env.DID_MICROSOFT_VOICE_ID;
    const originalChineseVoice = process.env.DID_MICROSOFT_VOICE_ID_ZH;
    delete process.env.DID_MICROSOFT_VOICE_ID;
    delete process.env.DID_MICROSOFT_VOICE_ID_ZH;

    try {
      const payload = buildAgentPayload({ characterName: '悠悠', language: 'zh' }, 'https://example.com/yoyo.png');

      expect(payload.greetings).toEqual(['你好，我是 悠悠。想聊天吗？']);
      expect(payload.llm.instructions).toContain('Always reply in Simplified Chinese');
      expect(payload.presenter).toMatchObject({
        voice: { type: 'microsoft', voice_id: 'zh-CN-XiaoxiaoNeural' },
      });
    } finally {
      if (originalVoice === undefined) delete process.env.DID_MICROSOFT_VOICE_ID;
      else process.env.DID_MICROSOFT_VOICE_ID = originalVoice;
      if (originalChineseVoice === undefined) delete process.env.DID_MICROSOFT_VOICE_ID_ZH;
      else process.env.DID_MICROSOFT_VOICE_ID_ZH = originalChineseVoice;
    }
  });

  test('uses expressive presenter only when D-ID llm provider is explicitly configured', () => {
    const originalProvider = process.env.DID_LLM_PROVIDER;
    process.env.DID_LLM_PROVIDER = 'd-id';

    try {
      const payload = buildAgentPayload({ characterName: 'Milo' }, 'https://example.com/milo.png');

      expect(payload.presenter).toMatchObject({ type: 'expressive', presenter_id: 'public_mia_elegant@avt_TJ0Tq5' });
      expect(payload.presenter).not.toHaveProperty('source_url');
      expect(payload.llm).toMatchObject({ provider: 'd-id', model: 'gpt-oss-120b' });
    } finally {
      if (originalProvider === undefined) delete process.env.DID_LLM_PROVIDER;
      else process.env.DID_LLM_PROVIDER = originalProvider;
    }
  });

  test('ignores stale D-ID-only model when using default OpenAI llm provider', () => {
    const originalProvider = process.env.DID_LLM_PROVIDER;
    const originalModel = process.env.DID_LLM_MODEL;
    delete process.env.DID_LLM_PROVIDER;
    process.env.DID_LLM_MODEL = 'gpt-oss-120b';

    try {
      const payload = buildAgentPayload({ characterName: 'Milo' }, 'https://example.com/milo.png');

      expect(payload.presenter).toMatchObject({ type: 'talk' });
      expect(payload.llm).toMatchObject({ provider: 'openai', model: 'gpt-4.1-mini' });
    } finally {
      if (originalProvider === undefined) delete process.env.DID_LLM_PROVIDER;
      else process.env.DID_LLM_PROVIDER = originalProvider;
      if (originalModel === undefined) delete process.env.DID_LLM_MODEL;
      else process.env.DID_LLM_MODEL = originalModel;
    }
  });

  test('random persona resolves to a concrete supported persona', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.999;

    try {
      expect(pickRandomPersona().id).not.toBe('random');
      expect(personas.some((persona) => persona.id === 'random')).toBe(true);
    } finally {
      Math.random = originalRandom;
    }
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
    expect(normalizeCustomImageEndpoint('https://router.shengsuanyun.com/api/v1', 'openai/gpt-image-2')).toBe('https://router.shengsuanyun.com/api/v1/images/generations');
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

  test('includes the source drawing in chat completions image requests', () => {
    const sourceImageDataUrl = 'data:image/png;base64,ZmFrZS1kcmF3aW5n';
    const body = buildChatCompletionsImageRequestBody({
      provider: 'custom',
      model: 'gemini-3-pro-image-preview-4k',
      prompt: 'keep the doodle pose',
      sourceImageDataUrl,
    });

    expect(JSON.parse(body)).toEqual({
      model: 'gemini-3-pro-image-preview-4k',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'keep the doodle pose' },
          { type: 'image_url', image_url: { url: sourceImageDataUrl } },
        ],
      }],
    });
  });

  test('includes the source drawing in responses image requests', () => {
    const sourceImageDataUrl = 'data:image/png;base64,ZmFrZS1kcmF3aW5n';
    const body = buildResponsesImageRequestBody({
      provider: 'custom',
      model: 'provider-image-model',
      prompt: 'keep the doodle colors',
      sourceImageDataUrl,
    });

    expect(JSON.parse(body)).toEqual({
      model: 'provider-image-model',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: 'keep the doodle colors' },
          { type: 'input_image', image_url: sourceImageDataUrl },
        ],
      }],
      tools: [{ type: 'image_generation' }],
    });
  });

  test('normalizes image generation URLs to image edit URLs', () => {
    expect(buildCustomImageEditEndpoint('https://api.example.com/v1/images/generations')).toBe('https://api.example.com/v1/images/edits');
    expect(buildCustomImageEditEndpoint('https://api.example.com/v1/images/edits')).toBe('https://api.example.com/v1/images/edits');
  });

  test('uses Shengsuanyun JSON payloads for image edits', () => {
    const sourceImageDataUrl = 'data:image/png;base64,ZmFrZS1kcmF3aW5n';
    const editEndpoint = buildCustomImageEditEndpoint('https://router.shengsuanyun.com/api/v1/images/generations');
    const body = buildCustomImageEditJsonRequestBody({
      provider: 'custom',
      model: 'openai/gpt-image-1.5',
      prompt: 'keep the doodle colors',
      sourceImageDataUrl,
    });

    expect(editEndpoint).toBe('https://router.shengsuanyun.com/api/v1/images/edits');
    expect(usesJsonImageEditPayload(editEndpoint)).toBe(true);
    expect(usesJsonImageEditPayload('https://api.openai.com/v1/images/edits')).toBe(false);
    expect(JSON.parse(body)).toEqual({
      model: 'openai/gpt-image-1.5',
      prompt: 'keep the doodle colors',
      image: sourceImageDataUrl,
      size: '1024x1024',
      n: 1,
      quality: 'medium',
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
  test('keeps encrypted secrets readable when screen dimensions change', async () => {
    const originalWindow = globalThis.window;
    const originalScreen = globalThis.screen;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        crypto: globalThis.crypto,
        location: { origin: 'http://localhost:3000' },
      },
    });
    Object.defineProperty(globalThis, 'screen', {
      configurable: true,
      value: { width: 1920, height: 1080 },
    });

    try {
      const encrypted = await encryptSecret('sk-proj-secret');
      Object.defineProperty(globalThis, 'screen', {
        configurable: true,
        value: { width: 1440, height: 900 },
      });

      expect(isCurrentSecretCipher(encrypted)).toBe(true);
      expect(await decryptSecret(encrypted)).toBe('sk-proj-secret');
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
      Object.defineProperty(globalThis, 'screen', { configurable: true, value: originalScreen });
    }
  });

  test('persists Shengsuanyun image endpoint and OpenAI-prefixed model names', () => {
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

    try {
      resetSettings();
      saveSettings({
        customImageEndpoint: 'https://router.shengsuanyun.com/api/v1',
        customImageModel: 'openai/gpt-image-2',
      });

      expect(loadSettings().customImageEndpoint).toBe('https://router.shengsuanyun.com/api/v1');
      expect(loadSettings().customImageModel).toBe('openai/gpt-image-2');
    } finally {
      resetSettings();
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    }
  });

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
