export const DID_AGENT_DEFAULT_EMBED_SRC = 'https://agent.d-id.com/v2/index.js';

export type DidAgentEmbedCredentials = {
  agentId?: string;
  clientKey?: string;
};

export function getDidAgentEmbedConfig(credentials?: DidAgentEmbedCredentials) {
  const agentId = credentials?.agentId || process.env.NEXT_PUBLIC_DID_AGENT_ID || '';
  const clientKey = credentials?.clientKey || process.env.NEXT_PUBLIC_DID_CLIENT_KEY || '';
  if (!agentId || !clientKey) return null;
  return {
    agentId,
    clientKey,
    src: process.env.NEXT_PUBLIC_DID_EMBED_SRC || DID_AGENT_DEFAULT_EMBED_SRC,
  };
}
