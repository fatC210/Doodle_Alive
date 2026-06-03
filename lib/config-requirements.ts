import type { AdvancedSettings } from './types';

export type ConfigIssue =
  | 'customImageEndpoint'
  | 'customImageModel'
  | 'customImageKey';

export function getMorphingConfigIssues(settings: AdvancedSettings, customImageKey: string): ConfigIssue[] {
  return [
    settings.customImageEndpoint.trim() ? null : 'customImageEndpoint',
    settings.customImageModel.trim() ? null : 'customImageModel',
    customImageKey.trim() ? null : 'customImageKey',
  ].filter(Boolean) as ConfigIssue[];
}
