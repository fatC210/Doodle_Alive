import { personas } from './data';
import { sanitizeForChild } from './safety';
import type { AdvancedSettings, DoodleCharacter } from './types';

export async function generateCharacterReply(input: string, character: DoodleCharacter, settings: AdvancedSettings) {
  const safeInput = sanitizeForChild(input);
  if (safeInput !== input.trim()) return safeInput;

  if (settings.llmSource !== 'custom' || !settings.customLlmEndpoint || !settings.customLlmKey) {
    throw new Error('A custom LLM endpoint and key are required before chat can generate replies.');
  }

  const response = await fetch(settings.customLlmEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.customLlmKey}`,
    },
    body: JSON.stringify({
      model: settings.builtInModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: character.personaPrompt || personas.find((persona) => persona.id === character.personaId)?.systemPrompt || '' },
        { role: 'user', content: input },
      ],
      max_tokens: 140,
    }),
  });
  if (!response.ok) throw new Error(`Custom LLM failed: ${response.status}`);
  const data = await response.json();
  const reply = String(data?.choices?.[0]?.message?.content || '');
  if (!reply) throw new Error('Custom LLM returned an empty reply.');
  return sanitizeForChild(reply);
}
