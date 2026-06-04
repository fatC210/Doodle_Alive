'use client';

export type DidAgentProvisionRequest = {
  characterId: string;
  characterName: string;
  personaPrompt?: string;
  imageDataUrl?: string;
  imageUrl?: string;
  agentId?: string;
  apiKey?: string;
  allowedDomains?: string;
  language?: string;
};

export type DidAgentProvisionResponse = {
  agentId: string;
  clientKey: string;
  sourceUrl: string;
  status?: string;
};

export type DidAgentClientKeyRequest = {
  agentId: string;
  apiKey?: string;
  allowedDomains?: string;
  characterName?: string;
  personaPrompt?: string;
  sourceUrl?: string;
  language?: string;
};

export type DidAgentClientKeyResponse = {
  clientKey: string;
};

export async function provisionDidAgent(request: DidAgentProvisionRequest): Promise<DidAgentProvisionResponse> {
  const response = await fetch('/api/did-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw new Error(await readErrorMessage(response));
  return await response.json() as DidAgentProvisionResponse;
}

export async function refreshDidAgentClientKey(request: DidAgentClientKeyRequest): Promise<DidAgentClientKeyResponse> {
  const response = await fetch('/api/did-agent/client-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) throw new Error(await readErrorMessage(response));
  return await response.json() as DidAgentClientKeyResponse;
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json() as { error?: string };
    if (data.error) return data.error;
  } catch {
    const text = await response.text().catch(() => '');
    if (text) return text;
  }
  return `D-ID Agent request failed: ${response.status}`;
}
