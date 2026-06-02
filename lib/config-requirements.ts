import type { AdvancedSettings } from './types';

export type ConfigIssue =
  | 'customImageEndpoint'
  | 'customImageModel'
  | 'customImageKey';

export function getMorphingConfigIssues(settings: AdvancedSettings, customImageKey: string): ConfigIssue[] {
  return [
    settings.customImageEndpoint ? null : 'customImageEndpoint',
    settings.customImageModel ? null : 'customImageModel',
    customImageKey ? null : 'customImageKey',
  ].filter(Boolean) as ConfigIssue[];
}
