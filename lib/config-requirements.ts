import type { AdvancedSettings, SecretKeys } from './types';

export type ConfigIssue =
  | 'customImageEndpoint'
  | 'customImageModel'
  | 'customImageKey'
  | 'didKey'
  | 'elevenLabsKey'
  | 'customLlmSource'
  | 'customLlmModel'
  | 'customLlmEndpoint'
  | 'customLlmKey';

export function getMorphingConfigIssues(settings: AdvancedSettings, _keys: SecretKeys, customImageKey: string): ConfigIssue[] {
  return [
    settings.customImageEndpoint ? null : 'customImageEndpoint',
    settings.customImageModel ? null : 'customImageModel',
    customImageKey ? null : 'customImageKey',
  ].filter(Boolean) as ConfigIssue[];
}

export function getPersonaConfigIssues(keys: SecretKeys): ConfigIssue[] {
  return keys.elevenLabs ? [] : ['elevenLabsKey'];
}

export function getCustomChatConfigIssues(settings: AdvancedSettings, customLlmKey: string): ConfigIssue[] {
  if (settings.llmSource !== 'custom') return [];

  return [
    settings.customLlmModel ? null : 'customLlmModel',
    settings.customLlmEndpoint ? null : 'customLlmEndpoint',
    customLlmKey ? null : 'customLlmKey',
  ].filter(Boolean) as ConfigIssue[];
}
