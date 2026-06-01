import { createDidAvatar, testDidKey } from './did';
import { testElevenLabsKey } from './elevenlabs';
import type { AdvancedSettings, ApiConnectionTestResult, ApiKeyName, SecretKeys } from './types';

export async function validateApiKey(name: ApiKeyName, keys: SecretKeys): Promise<ApiConnectionTestResult> {
  const testedAt = new Date().toISOString();
  if (!keys[name]) return { key: name, status: 'missing', message: 'Key is missing.', testedAt };

  try {
    if (name === 'elevenLabs') {
      const valid = await testElevenLabsKey(keys.elevenLabs);
      return { key: name, status: valid ? 'valid' : 'invalid', message: valid ? 'ElevenLabs returned a response.' : 'ElevenLabs did not return a response.', testedAt };
    }

    if (name === 'did') {
      const valid = await testDidKey(keys.did);
      return { key: name, status: valid ? 'valid' : 'invalid', message: valid ? 'D-ID returned a response.' : 'D-ID did not return a response.', testedAt };
    }
    return { key: name, status: 'invalid', message: 'Unsupported key.', testedAt };
  } catch (error) {
    return {
      key: name,
      status: 'invalid',
      message: error instanceof Error ? error.message : 'Connection test failed.',
      testedAt,
    };
  }
}

export async function validateDidAvatarForGeneratedImage(args: {
  didKey: string;
  imageProvider: AdvancedSettings['imageProvider'];
  generatedImageUrl?: string;
  generatedImageDataUrl?: string;
  generatedImageBlob?: Blob;
}) {
  return createDidAvatar({
    apiKey: args.didKey,
    imageUrl: args.generatedImageUrl,
    imageDataUrl: args.generatedImageDataUrl,
    imageBlob: args.generatedImageBlob,
    provider: args.imageProvider,
  });
}
