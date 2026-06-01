import { DEFAULT_STYLE_ID, styles } from './data';

const DEFAULT_ACCENTS = ['#3d72e8', '#ff8d91', '#ffc35f'];
const WHITE_DISTANCE = 42;
const CONTENT_DISTANCE = 30;
const MIN_CONTENT_PIXELS = 8;
const GUIDE_COLORS = [
  [165, 176, 205],
  [190, 199, 220],
];

export function extractAccentColors(imageData: ImageData, backgroundColor = '#ffffff', limit = 3) {
  const bg = hexToRgb(backgroundColor);
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const stride = 16;

  for (let index = 0; index < imageData.data.length; index += 4 * stride) {
    const alpha = imageData.data[index + 3];
    if (alpha < 80) continue;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    if (isNearWhite(r, g, b) || colorDistance([r, g, b], bg) < WHITE_DISTANCE || isGuideColor(r, g, b)) continue;

    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    const current = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    current.count += 1;
    current.r += r;
    current.g += g;
    current.b += b;
    buckets.set(key, current);
  }

  const accents = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) => rgbToHex(Math.round(bucket.r / bucket.count), Math.round(bucket.g / bucket.count), Math.round(bucket.b / bucket.count)));

  return accents.length ? accents : DEFAULT_ACCENTS.slice(0, limit);
}

export function hasVisibleCanvasContent(imageData: ImageData, backgroundColor = '#ffffff') {
  const bg = hexToRgb(backgroundColor);
  let visiblePixels = 0;
  const stride = 4;

  for (let index = 0; index < imageData.data.length; index += 4 * stride) {
    const alpha = imageData.data[index + 3];
    if (alpha < 80) continue;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    if (colorDistance([r, g, b], bg) < CONTENT_DISTANCE || isGuideColor(r, g, b)) continue;
    visiblePixels += 1;
    if (visiblePixels >= MIN_CONTENT_PIXELS) return true;
  }

  return false;
}

export function buildImagePrompt(styleId: string, accentColors: string[], backgroundColor = '#ffffff', options: { isBlankCanvas?: boolean } = {}) {
  void backgroundColor;
  const style = styles.find((item) => item.id === styleId) ?? styles.find((item) => item.id === DEFAULT_STYLE_ID) ?? styles[0];
  const colorText = accentColors.length ? accentColors.join(', ') : DEFAULT_ACCENTS.join(', ');
  const subject = options.isBlankCanvas
    ? 'random friendly real human face, unique wholesome person, original facial features, warm approachable expression'
    : 'transform the provided original image into a real human face portrait, preserve the original image colors, shapes, mood, and character idea';
  return [
    style.prompt,
    'use the selected style as visual direction while keeping a photorealistic human face',
    'D-ID compatible real person portrait',
    'one single human subject',
    'frontal facing portrait',
    'head and shoulders upper body',
    'natural realistic skin texture',
    'real human facial proportions',
    'neutral expression',
    'closed mouth',
    'open eyes',
    'both eyes clearly visible',
    'solid clean white background',
    subject,
    `wearing ${colorText} colored clothes and accessories`,
    'kid-friendly friendly person portrait',
    'clear recognizable face',
    'soft safe lighting',
    'not a cartoon avatar',
    'not an animal or object character',
    'no masks or face coverings',
    'no scary details',
    'no weapons',
    '1024x1024',
  ].join(', ');
}

export function negativePrompt() {
  return 'violence, weapon, horror, scary, blood, gore, adult content, open mouth, closed eyes, side profile, cropped face, blurry, extra limbs, text, watermark, non-human face, animal face, mask, covered face, flat cartoon avatar';
}

function isNearWhite(r: number, g: number, b: number) {
  return r > 238 && g > 238 && b > 238;
}

function isGuideColor(r: number, g: number, b: number) {
  return GUIDE_COLORS.some((guide) => colorDistance([r, g, b], guide) < 34);
}

function colorDistance(a: number[], b: number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').padEnd(6, 'f');
  return [0, 2, 4].map((start) => Number.parseInt(normalized.slice(start, start + 2), 16));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
