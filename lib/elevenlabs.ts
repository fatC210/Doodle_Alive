import type { DoodleCharacter, PersonaPreset } from './types';

const ELEVEN_API_BASE = 'https://api.elevenlabs.io/v1';

interface CreateAgentInput {
  apiKey: string;
  persona: PersonaPreset;
  character: Pick<DoodleCharacter, 'name' | 'styleName' | 'prompt'>;
  llmSource: 'built-in' | 'custom';
  model: string;
  customLlmModel?: string;
  customLlmEndpoint?: string;
}

export async function testElevenLabsKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const response = await fetch(`${ELEVEN_API_BASE}/user`, { headers: elevenHeaders(apiKey) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createElevenAgent(input: CreateAgentInput): Promise<{ agentId: string; message: string }> {
  if (!input.apiKey) {
    throw new Error('ElevenLabs API key is missing. Add it in Settings, then try again.');
  }

  try {
    const response = await fetch(`${ELEVEN_API_BASE}/convai/agents/create`, {
      method: 'POST',
      headers: { ...elevenHeaders(input.apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${input.character.name} - Doodle Alive`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: buildAgentPrompt(input.persona, input.character),
              llm: input.llmSource === 'custom' ? 'custom-llm' : input.model,
              ...(input.llmSource === 'custom' && input.customLlmEndpoint ? {
                custom_llm: {
                  url: input.customLlmEndpoint,
                  ...(input.customLlmModel ? { model_id: input.customLlmModel } : {}),
                },
              } : {}),
            },
            first_message: `Hi! I'm ${input.character.name}. What should we imagine today?`,
            language: 'en',
          },
          conversation: {
            text_only: false,
            client_events: ['agent_response', 'agent_response_correction', 'agent_chat_response_part', 'agent_response_complete'],
          },
          tts: {
            voice_id: input.persona.voiceId,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`ElevenLabs agent request failed: ${response.status}`);
    const data = await response.json();
    const agentId = String(data?.agent_id || data?.id || '');
    if (!agentId) throw new Error('ElevenLabs did not return an agent id.');
    return { agentId, message: 'ElevenAgents profile is ready.' };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'ElevenLabs agent setup failed.');
  }
}

export async function getElevenConversationToken(agentId: string, apiKey: string) {
  if (!agentId) throw new Error('This character does not have an ElevenLabs agent yet. Create the character again after saving Settings.');
  if (!apiKey) throw new Error('ElevenLabs API key is missing. Add it in Settings, then try again.');
  const response = await fetch(`${ELEVEN_API_BASE}/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
    headers: elevenHeaders(apiKey),
  });
  if (!response.ok) throw new Error(`ElevenLabs conversation token failed: ${response.status}`);
  const data = await response.json();
  const token = String(data?.token || '');
  if (!token) throw new Error('ElevenLabs did not return a conversation token.');
  return token;
}

export function elevenConversationWebSocketUrl(agentId: string) {
  return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(agentId)}`;
}

export async function getElevenConversationSignedUrl(agentId: string, apiKey: string) {
  if (!apiKey) throw new Error('ElevenLabs API key is missing. Add it in Settings, then try again.');
  const response = await fetch(`${ELEVEN_API_BASE}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: elevenHeaders(apiKey),
  });
  if (!response.ok) throw new Error(`ElevenLabs conversation auth failed: ${response.status}`);
  const data = await response.json();
  const signedUrl = String(data?.signed_url || '');
  if (!signedUrl) throw new Error('ElevenLabs did not return a signed conversation URL.');
  return signedUrl;
}

export function buildAgentPrompt(persona: PersonaPreset, character: Pick<DoodleCharacter, 'name' | 'styleName' | 'prompt'>) {
  return [
    `You are ${character.name}, a Doodle Alive character drawn by a child.`,
    `Visual style: ${character.styleName}.`,
    character.prompt ? `Image prompt context: ${character.prompt}` : '',
    persona.systemPrompt,
    'Keep turns under 45 words unless the child asks for a story.',
    'Never claim to be a real person or ask to meet offline.',
  ].filter(Boolean).join('\n');
}

function elevenHeaders(apiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    'xi-api-key': apiKey,
  };
}
