import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

type PublicImageInput = {
  characterId?: string;
  imageDataUrl?: string;
  imageUrl?: string;
};

type ParsedDataUrl = {
  bytes: Buffer;
  contentType: string;
  extension: string;
};

export async function resolvePublicImageUrl(input: PublicImageInput) {
  const publicImageUrl = normalizeHttpUrl(input.imageUrl);
  if (!input.imageDataUrl?.startsWith('data:image/')) return publicImageUrl;
  if (!isBlobUploadConfigured()) return publicImageUrl;

  try {
    return await uploadDataUrlToBlob(input.imageDataUrl, input.characterId);
  } catch (error) {
    if (publicImageUrl) return publicImageUrl;
    const message = error instanceof Error ? error.message : 'Unknown Vercel Blob upload error.';
    throw new Error(`Public image hosting failed: ${message}`);
  }
}

function isBlobUploadConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function uploadDataUrlToBlob(imageDataUrl: string, characterId: string | undefined) {
  const parsed = parseImageDataUrl(imageDataUrl);
  const pathname = buildBlobPathname(characterId, parsed.extension);
  const blob = await put(pathname, parsed.bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: parsed.contentType,
  });

  return blob.url;
}

function parseImageDataUrl(imageDataUrl: string): ParsedDataUrl {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) throw new Error('Only PNG, JPEG, or WEBP data URLs can be hosted for D-ID.');

  const [, rawContentType, rawBase64] = match;
  const contentType = rawContentType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : rawContentType.toLowerCase();
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.replace('image/', '');
  const base64 = rawBase64.replace(/\s/g, '');
  return { bytes: Buffer.from(base64, 'base64'), contentType, extension };
}

function buildBlobPathname(characterId: string | undefined, extension: string) {
  const safeCharacterId = safePathSegment(characterId || 'character');
  return `doodle-alive/characters/${safeCharacterId}-${Date.now()}-${randomUUID()}.${extension}`;
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 60) || 'character';
}

function normalizeHttpUrl(url: string | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : '';
  } catch {
    return '';
  }
}
