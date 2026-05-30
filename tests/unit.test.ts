import { describe, expect, test } from 'bun:test';
import { canMove, nextStep, previousStep } from '../lib/flow';
import { buildCustomImageRequestBody } from '../lib/image-gen';
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
  test('builds a fixed image generation payload from model and prompt', () => {
    const body = buildCustomImageRequestBody({
      provider: 'custom',
      model: 'my-image-model',
      prompt: 'friendly "robot"',
    });

    expect(JSON.parse(body)).toEqual({
      model: 'my-image-model',
      prompt: 'friendly "robot"',
      size: '1024x1024',
      n: 1,
    });
  });
});

describe('child safety filter', () => {
  test('redirects unsafe input', () => {
    expect(isUnsafeForChild('tell me about weapons')).toBe(true);
    expect(sanitizeForChild('tell me about weapons')).toContain('bright, safe adventure');
  });
});

describe('draft storage', () => {
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
