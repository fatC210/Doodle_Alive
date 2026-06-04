export type CreationStep = 'DRAW' | 'STYLE' | 'MORPHING' | 'PERSONA' | 'TALKING';

export type LanguageCode = 'en' | 'zh';

export type ImageProviderType = 'custom';

export type ApiKeyStatus = 'valid' | 'missing' | 'invalid' | 'untested';
export type ConnectionStatus = 'idle' | 'connecting' | 'ready' | 'listening' | 'thinking' | 'speaking' | 'reconnecting' | 'error' | 'text';

export interface StylePreset {
  id: string;
  name: string;
  nameZh: string;
  desc: string;
  descZh: string;
  prompt: string;
  tone: string;
  image: string;
}

export interface PersonaPreset {
  id: string;
  name: string;
  nameZh: string;
  desc: string;
  descZh: string;
  systemPrompt: string;
  voice: string;
  voiceZh: string;
  icon: string;
  tone: string;
}

export interface DoodleCharacter {
  id: string;
  name: string;
  styleId: string;
  styleName: string;
  personaId: string;
  personaName: string;
  createdAt: string;
  updatedAt: string;
  originalImage?: Blob;
  originalDataUrl?: string;
  generatedImage?: Blob;
  generatedDataUrl?: string;
  generatedImageUrl?: string;
  accentColors: string[];
  prompt: string;
  personaPrompt?: string;
  randomPersonaId?: string;
  tone?: string;
  didAgentId?: string;
  didClientKey?: string;
  didSourceUrl?: string;
  didPosterUrl?: string;
  didStatus?: string;
}

export interface ChatMessage {
  id: string;
  characterId: string;
  role: 'character' | 'user' | 'system';
  content: string;
  timestamp: string;
  imageUrl?: string;
}

export interface CreationDraft {
  step: CreationStep;
  originalDataUrl?: string;
  generatedDataUrl?: string;
  generatedImageUrl?: string;
  styleId?: string;
  styleChoiceMode?: 'manual' | 'random';
  characterName?: string;
  personaId?: string;
  accentColors: string[];
  prompt?: string;
  backgroundColor: string;
  isBlankCanvas?: boolean;
}

export interface AdvancedSettings {
  imageProvider: ImageProviderType;
  customImageKey: string;
  customImageModel: string;
  customImageEndpoint: string;
  language: LanguageCode;
}


export interface ImageGenerationRequest {
  prompt: string;
  sourceImageDataUrl?: string;
  provider: ImageProviderType;
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

export interface ImageGenerationResult {
  imageUrl?: string;
  imageDataUrl?: string;
  blob?: Blob;
  provider: ImageProviderType;
  warning?: string;
}


export interface RealtimeConnectionState {
  live: ConnectionStatus;
  stt: ConnectionStatus;
  agent: ConnectionStatus;
  avatar: ConnectionStatus;
  message: string;
  reconnectAttempts: number;
  textModeReason?: string;
}
