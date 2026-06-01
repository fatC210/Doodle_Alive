import { personas } from './data';
import { getElevenConversationSignedUrl } from './elevenlabs';
import { sanitizeForChild } from './safety';
import type { AdvancedSettings, DoodleCharacter } from './types';

interface CharacterReplySecrets {
  elevenLabs?: string;
}

type ElevenConversationEvent = {
  type?: string;
  ping_event?: { event_id?: number | string; ping_ms?: number };
  agent_response_event?: { agent_response?: string };
  agent_response_correction_event?: { corrected_agent_response?: string };
  text_response_part?: { text?: string; type?: string; event_id?: number | string };
  client_error_event?: { message?: string };
};

export async function generateCharacterReply(input: string, character: DoodleCharacter, settings: AdvancedSettings, secrets: CharacterReplySecrets = {}) {
  const safeInput = sanitizeForChild(input);
  if (safeInput !== input.trim()) return safeInput;

  if (settings.llmSource !== 'custom') {
    return generateElevenAgentTextReply(input, character, secrets.elevenLabs || '');
  }

  if (!settings.customLlmModel || !settings.customLlmEndpoint || !settings.customLlmKey) {
    throw new Error('A custom LLM model, endpoint, and key are required for custom LLM chat.');
  }

  const response = await fetch(settings.customLlmEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.customLlmKey}`,
    },
    body: JSON.stringify({
      model: settings.customLlmModel,
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

async function generateElevenAgentTextReply(input: string, character: DoodleCharacter, elevenLabsKey: string) {
  if (!character.agentId) throw new Error('This character does not have an ElevenLabs agent yet. Create the character again after saving Settings.');

  const url = await getElevenConversationSignedUrl(character.agentId, elevenLabsKey);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let responseText = '';
    let sentUserMessage = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => finish(new Error('ElevenLabs agent did not reply in time.')), 30000);
    const socket = new WebSocket(url);

    function send(payload: object) {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    }

    function sendUserMessage() {
      if (sentUserMessage) return;
      sentUserMessage = true;
      send({ type: 'user_message', text: input });
    }

    function finish(result: string | Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (idleTimer) clearTimeout(idleTimer);
      socket.close();
      if (result instanceof Error) reject(result);
      else resolve(sanitizeForChild(result));
    }

    function scheduleIdleFinish() {
      if (!responseText) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => finish(responseText), 900);
    }

    socket.onopen = () => {
      send({ type: 'conversation_initiation_client_data' });
      setTimeout(sendUserMessage, 250);
    };

    socket.onmessage = (event) => {
      const data = parseConversationEvent(event.data);
      if (!data) return;

      if (data.type === 'ping') {
        setTimeout(() => send({ type: 'pong', event_id: data.ping_event?.event_id }), data.ping_event?.ping_ms || 0);
        return;
      }

      if (data.type === 'conversation_initiation_metadata') sendUserMessage();

      if (data.type === 'agent_response' && data.agent_response_event?.agent_response) {
        finish(data.agent_response_event.agent_response);
        return;
      }

      if (data.type === 'agent_response_correction' && data.agent_response_correction_event?.corrected_agent_response) {
        responseText = data.agent_response_correction_event.corrected_agent_response;
        scheduleIdleFinish();
        return;
      }

      if (data.type === 'agent_chat_response_part' && data.text_response_part?.text) {
        responseText += data.text_response_part.text;
        scheduleIdleFinish();
        return;
      }

      if (data.type === 'agent_response_complete' && responseText) finish(responseText);
      if (data.type === 'client_error') finish(new Error(data.client_error_event?.message || 'ElevenLabs agent returned an error.'));
    };

    socket.onerror = () => finish(new Error('Could not connect to the ElevenLabs agent.'));
    socket.onclose = () => {
      if (!settled && responseText) finish(responseText);
      if (!settled) finish(new Error('ElevenLabs agent connection closed before a reply was received.'));
    };
  });
}

function parseConversationEvent(data: unknown): ElevenConversationEvent | null {
  try {
    return JSON.parse(String(data)) as ElevenConversationEvent;
  } catch {
    return null;
  }
}
