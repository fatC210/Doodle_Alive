'use client';

import { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { defaultSettings } from '@/lib/data';
import { useLanguage } from '@/lib/i18n';
import { loadCustomImageKey, loadDidApiKey, saveCustomImageKey, saveDidApiKey } from '@/lib/secrets';
import { loadSettings, saveSettings } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import type { AdvancedSettings, ApiKeyStatus } from '@/lib/types';

type ImageProviderStatus = {
  status: ApiKeyStatus;
};

export function ApiKeysForm() {
  const { t } = useLanguage();
  const [didApiKey, setDidApiKey] = useState('');
  const [didStatus, setDidStatus] = useState<ApiKeyStatus>('missing');
  const [testingDidKey, setTestingDidKey] = useState(false);

  useEffect(() => {
    async function load() {
      const loadedDidApiKey = await loadDidApiKey();
      setDidApiKey(loadedDidApiKey);
      setDidStatus(loadedDidApiKey.trim() ? 'untested' : 'missing');
    }
    load();
  }, []);

  function updateDidApiKey(value: string) {
    setDidApiKey(value);
    setDidStatus(value.trim() ? 'untested' : 'missing');
  }

  async function saveAndValidateDidKey() {
    const nextKey = didApiKey.trim();
    await saveDidApiKey(nextKey);
    if (!nextKey) {
      setDidStatus('missing');
      return;
    }

    setTestingDidKey(true);
    setDidStatus('untested');
    try {
      const response = await fetch('/api/did-agent/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: nextKey }),
      });
      setDidStatus(response.ok ? 'valid' : 'invalid');
    } catch {
      setDidStatus('invalid');
    } finally {
      setTestingDidKey(false);
    }
  }

  return (
    <section className="settings-section card">
      <div className="settings-section-header">
        <span>
          <h2>{t('apiKeysTitle')}</h2>
          <p className="subtitle">{t('didAgentProvisioningCopy')}</p>
        </span>
      </div>
      <div className="image-config-stack">
        <div className="config-grid">
          <label className="form-field">
            {t('didApiKey')}
            <input
              value={didApiKey}
              onChange={(event) => updateDidApiKey(event.target.value)}
              onBlur={() => void saveAndValidateDidKey()}
              placeholder="Basic ..."
              type="password"
            />
          </label>
        </div>
        <div className="save-row">
          <span className={`test-meta ${didStatus === 'valid' ? 'valid' : ''}`}>
            {testingDidKey ? t('testing') : statusLabel(didStatus, t)}
          </span>
        </div>
      </div>
    </section>
  );
}

export function AdvancedSettingsForm() {
  const { t, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AdvancedSettings>(defaultSettings);
  const [customImageKey, setCustomImageKey] = useState('');
  const [imageProviderStatus, setImageProviderStatus] = useState<ImageProviderStatus>({ status: 'missing' });

  useEffect(() => {
    async function load() {
      const loadedSettings = loadSettings();
      const loadedCustomImageKey = await loadCustomImageKey();
      setSettings(loadedSettings);
      setCustomImageKey(loadedCustomImageKey);
      setImageProviderStatus({ status: hasCompleteImageProviderConfig(loadedSettings, loadedCustomImageKey) ? 'valid' : 'missing' });
    }
    load();
  }, []);

  function update<K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === 'language') {
      setLanguage(value as AdvancedSettings['language']);
    }
    saveSettings({ [key]: value } as Partial<AdvancedSettings>);
  }

  function updateCustomImageSetting<K extends 'customImageEndpoint' | 'customImageModel'>(key: K, value: AdvancedSettings[K]) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setImageProviderStatus({ status: hasCompleteImageProviderConfig(nextSettings, customImageKey) ? 'untested' : 'missing' });
  }

  function updateCustomImageKey(value: string) {
    setCustomImageKey(value);
    setImageProviderStatus({ status: hasCompleteImageProviderConfig(settings, value) ? 'untested' : 'missing' });
  }

  async function saveCustomImageProvider(next?: Partial<Pick<AdvancedSettings, 'customImageEndpoint' | 'customImageModel'>> & { customImageKey?: string }) {
    const nextSettings = {
      ...settings,
      customImageEndpoint: next?.customImageEndpoint ?? settings.customImageEndpoint,
      customImageModel: next?.customImageModel ?? settings.customImageModel,
    };
    const nextCustomImageKey = next?.customImageKey ?? customImageKey;

    setSettings(nextSettings);
    setCustomImageKey(nextCustomImageKey);
    saveSettings({
      customImageEndpoint: nextSettings.customImageEndpoint,
      customImageModel: nextSettings.customImageModel,
    });
    await saveCustomImageKey(nextCustomImageKey);

    if (!hasCompleteImageProviderConfig(nextSettings, nextCustomImageKey)) {
      setImageProviderStatus({ status: 'missing' });
      return;
    }

    setImageProviderStatus({ status: 'valid' });
  }

  function reset() {
    setSettings(defaultSettings);
    setCustomImageKey('');
    void saveCustomImageKey('');
    saveSettings(defaultSettings);
    setImageProviderStatus({ status: 'missing' });
    setLanguage(defaultSettings.language);
    setTheme('light');
  }

  return (
    <section className="settings-section card">
      <div className="settings-section-header">
        <span>
          <h2>{t('advancedConfig')}</h2>
          <p className="subtitle">{t('advancedConfigCopy')}</p>
        </span>
        <button className="ghost-button" onClick={reset}><RotateCcw size={16} /> {t('resetDefaults')}</button>
      </div>
      <div className="advanced-content">
        <section className="config-section">
          <span className="config-number">1</span>
          <div className="config-body">
            <h3>{t('imageProvider')}</h3>
            <p className="subtitle">{t('imageProviderCopy')}</p>
            <div className="provider-status-row">
              <span className={`test-meta ${imageProviderStatus.status === 'valid' ? 'valid' : ''}`}>
                <span aria-hidden="true">●</span> {imageProviderStatusLabel(imageProviderStatus, t)}
              </span>
              <span className={`status-badge ${imageProviderStatus.status === 'valid' ? '' : 'missing'}`}>
                {imageProviderStatusBadgeLabel(imageProviderStatus, t)}
                {imageProviderStatus.status === 'valid' ? <Check size={14} /> : <span className="badge-mark">!</span>}
              </span>
            </div>
            <div className="image-config-stack">
              <div className="config-grid">
                <label className="form-field">
                  {t('endpointUrl')}
                  <input
                    value={settings.customImageEndpoint}
                    onChange={(event) => updateCustomImageSetting('customImageEndpoint', event.target.value)}
                    placeholder={t('customImageEndpointPlaceholder')}
                  />
                </label>
                <label className="form-field">
                  {t('customImageKey')}
                  <input
                    value={customImageKey}
                    onChange={(event) => updateCustomImageKey(event.target.value)}
                    placeholder="sk-••••••••••••••••••••"
                    type="password"
                  />
                </label>
              </div>
              <div className="config-grid">
                <label className="form-field">
                  {t('imageModel')}
                  <input
                    value={settings.customImageModel}
                    onChange={(event) => updateCustomImageSetting('customImageModel', event.target.value)}
                    placeholder={t('imageModelPlaceholder')}
                  />
                </label>
              </div>
              <div className="save-row">
                <button className="primary-button" type="button" onClick={() => void saveCustomImageProvider()}>
                  {t('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="config-section">
          <span className="config-number">2</span>
          <div className="config-body preference-group">
            <div className="preference-item">
              <h3>{t('theme')}</h3>
              <p className="subtitle">{t('themeCopy')}</p>
              <div className="language-toggle">
                <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>{t('lightTheme')}</button>
                <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>{t('darkTheme')}</button>
              </div>
              <p className="subtitle">{t('themeInstant')}</p>
            </div>
            <div className="preference-item">
              <h3>{t('language')}</h3>
              <p className="subtitle">{t('languageCopy')}</p>
              <div className="language-toggle">
                <button type="button" className={settings.language === 'en' ? 'active' : ''} onClick={() => update('language', 'en')}>{t('english')}</button>
                <button type="button" className={settings.language === 'zh' ? 'active' : ''} onClick={() => update('language', 'zh')}>{t('chinese')}</button>
              </div>
              <p className="subtitle">{t('languageInstant')}</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function hasCompleteImageProviderConfig(settings: AdvancedSettings, customImageKey: string) {
  return Boolean(
    settings.customImageEndpoint.trim()
    && settings.customImageModel.trim()
    && customImageKey.trim(),
  );
}

function statusLabel(status: string, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'valid') return t('valid');
  if (status === 'invalid') return t('invalid');
  if (status === 'missing') return t('missing');
  return t('untested');
}

function imageProviderStatusLabel(status: ImageProviderStatus, t: ReturnType<typeof useLanguage>['t']) {
  if (status.status === 'valid') return t('allChangesSaved');
  if (status.status === 'missing') return t('imageConfigMissing');
  if (status.status === 'invalid') return t('invalid');
  return t('unsavedChanges');
}

function imageProviderStatusBadgeLabel(status: ImageProviderStatus, t: ReturnType<typeof useLanguage>['t']) {
  if (status.status === 'valid') return t('saved');
  if (status.status === 'missing') return t('missing');
  if (status.status === 'invalid') return t('invalid');
  return t('unsaved');
}
