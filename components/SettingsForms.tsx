'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Check, Eye, LockKeyhole, RotateCcw, Shield } from 'lucide-react';
import { apiKeys, defaultSettings, elevenBuiltInModels } from '@/lib/data';
import { testImageProviderResponse } from '@/lib/image-gen';
import { useLanguage } from '@/lib/i18n';
import { loadCustomImageKey, loadCustomLlmKey, loadKeyStatuses, loadSecretKeys, saveCustomImageKey, saveCustomLlmKey, saveKeyStatus, saveSecretKeys } from '@/lib/secrets';
import { validateApiKey } from '@/lib/settings-validation';
import { loadSettings, saveSettings } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import type { AdvancedSettings, ApiConnectionTestResult, ApiKeyName, ApiKeyStatus, SecretKeys } from '@/lib/types';
import { SystemSelect } from '@/components/SystemSelect';

const IMAGE_PROVIDER_TEST_PROMPT = 'A simple smiling star character, flat color icon on a white background.';

type ApiKeyRow = {
  name: string;
  tag: string;
  note: string;
  icon: string;
  field: ApiKeyName;
  status: ApiKeyStatus;
  testedAt: string | undefined;
  good: boolean;
};

type ApiKeyCardProps = {
  row: ApiKeyRow;
  value: string;
  visible: boolean;
  testing: boolean;
  language: 'en' | 'zh';
  t: ReturnType<typeof useLanguage>['t'];
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  onToggleVisible: () => void;
  className?: string;
};

type ImageProviderStatus = {
  status: ApiKeyStatus;
  testedAt?: string;
};

type CustomLlmConfig = Pick<AdvancedSettings, 'customLlmEndpoint' | 'customLlmModel'> & {
  customLlmKey: string;
};

const apiKeyLogos: Record<ApiKeyName, { src: string; width: number; height: number }> = {
  elevenLabs: { src: '/images/elevenlabs-symbol.png', width: 456, height: 680 },
  did: { src: '/images/d-id-logo.png', width: 449, height: 376 },
};

export function ApiKeysForm() {
  const { language, t } = useLanguage();
  const [keys, setKeys] = useState<SecretKeys>({ elevenLabs: '', did: '' });
  const [statuses, setStatuses] = useState<Partial<Record<ApiKeyName, ApiConnectionTestResult>>>({});
  const [testing, setTesting] = useState<ApiKeyName | ''>('');
  const [visibleKeys, setVisibleKeys] = useState<Partial<Record<ApiKeyName, boolean>>>({});

  useEffect(() => {
    async function load() {
      setKeys(await loadSecretKeys());
      setStatuses(loadKeyStatuses());
    }
    load();
  }, []);

  function updateKey(field: ApiKeyName, value: string) {
    setKeys((current) => ({ ...current, [field]: value }));
    setStatuses((current) => ({
      ...current,
      [field]: {
        key: field,
        status: value ? 'untested' : 'missing',
        message: value ? t('savedSecurely') : t('keyMissing'),
        testedAt: new Date().toISOString(),
      },
    }));
  }

  async function saveAndValidateKey(field: ApiKeyName, value: string) {
    setKeys((current) => ({ ...current, [field]: value }));
    setTesting(field);
    try {
      await saveSecretKeys({ [field]: value });
      const result = value
        ? await validateApiKey(field, { ...keys, [field]: value })
        : { key: field, status: 'missing' as const, message: t('keyMissing'), testedAt: new Date().toISOString() };
      saveKeyStatus(result);
      setStatuses((current) => ({ ...current, [field]: result }));
    } finally {
      setTesting('');
    }
  }

  async function resetAll() {
    const emptyKeys: SecretKeys = { elevenLabs: '', did: '' };
    await saveSecretKeys(emptyKeys);
    const now = new Date().toISOString();
    const next: Partial<Record<ApiKeyName, ApiConnectionTestResult>> = {
      elevenLabs: { key: 'elevenLabs', status: 'missing', message: t('keyMissing'), testedAt: now },
      did: { key: 'did', status: 'missing', message: t('keyMissing'), testedAt: now },
    };
    Object.values(next).forEach((result) => result && saveKeyStatus(result));
    setKeys(emptyKeys);
    setStatuses(next);
  }

  const keyFields: ApiKeyName[] = ['elevenLabs', 'did'];
  const rows = apiKeys.map((key, index) => {
    const field = keyFields[index];
    if (!field) return null;
    const status = statuses[field]?.status ?? (!keys[field] ? 'missing' : 'untested');
    const testedAt = statuses[field]?.testedAt;
    return { ...key, field, status, testedAt, good: status === 'valid' };
  }).filter(Boolean) as ApiKeyRow[];
  const missingCount = rows.filter((row) => row.status === 'missing').length;

  return (
    <section className="settings-section card">
      <div className="settings-section-header">
        <span>
          <h2>{t('apiKeysTitle')}</h2>
          <p className="subtitle">{missingCount ? t('apiAttentionCopy') : t('apiReady')}</p>
        </span>
        <span className="security-note"><Shield size={16} /> {t('keysSafe')}</span>
      </div>

      <div className="api-list">
        {rows.map((row) => (
          <ApiKeyCard
            key={row.name}
            row={row}
            value={keys[row.field] || ''}
            visible={!!visibleKeys[row.field]}
            testing={testing === row.field}
            language={language}
            t={t}
            onChange={(value) => updateKey(row.field, value)}
            onBlur={(value) => void saveAndValidateKey(row.field, value)}
            onToggleVisible={() => setVisibleKeys((current) => ({ ...current, [row.field]: !current[row.field] }))}
          />
        ))}
      </div>

      <div className="save-row">
        <button className="ghost-button" type="button" onClick={resetAll}><RotateCcw size={16} /> {t('resetDefaults')}</button>
      </div>
    </section>
  );
}

export function AdvancedSettingsForm() {
  const { language, t, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AdvancedSettings>(defaultSettings);
  const [customLlmKey, setCustomLlmKey] = useState('');
  const [customLlmStatus, setCustomLlmStatus] = useState<ImageProviderStatus>({ status: 'missing' });
  const [customImageKey, setCustomImageKey] = useState('');
  const [imageProviderStatus, setImageProviderStatus] = useState<ImageProviderStatus>({ status: 'missing' });
  const [testingCustomLlm, setTestingCustomLlm] = useState(false);
  const [testingImageProvider, setTestingImageProvider] = useState(false);
  const customLlmTestRunRef = useRef(0);
  const imageProviderTestRunRef = useRef(0);

  useEffect(() => {
    async function load() {
      const loadedSettings = loadSettings();
      const loadedCustomImageKey = await loadCustomImageKey();
      const loadedCustomLlmKey = await loadCustomLlmKey();
      setSettings(loadedSettings);
      setCustomLlmKey(loadedCustomLlmKey);
      setCustomImageKey(loadedCustomImageKey);
      setCustomLlmStatus({ status: hasCompleteCustomLlmConfig(loadedSettings, loadedCustomLlmKey) ? 'untested' : 'missing' });
      setImageProviderStatus({ status: hasCompleteImageProviderConfig(loadedSettings, loadedCustomImageKey) ? 'untested' : 'missing' });
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

  function updateCustomLlmSetting<K extends 'customLlmEndpoint' | 'customLlmModel'>(key: K, value: AdvancedSettings[K]) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setCustomLlmStatus({ status: hasCompleteCustomLlmConfig(nextSettings, customLlmKey) ? 'untested' : 'missing' });
  }

  function updateCustomLlmKey(value: string) {
    setCustomLlmKey(value);
    setCustomLlmStatus({ status: hasCompleteCustomLlmConfig(settings, value) ? 'untested' : 'missing' });
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

  async function saveAndValidateCustomLlmProvider(next?: Partial<Pick<AdvancedSettings, 'customLlmEndpoint' | 'customLlmModel'>> & { customLlmKey?: string }) {
    const nextSettings = {
      ...settings,
      llmSource: 'custom' as const,
      customLlmEndpoint: next?.customLlmEndpoint ?? settings.customLlmEndpoint,
      customLlmModel: next?.customLlmModel ?? settings.customLlmModel,
    };
    const nextCustomLlmKey = next?.customLlmKey ?? customLlmKey;
    const runId = customLlmTestRunRef.current + 1;
    customLlmTestRunRef.current = runId;

    setSettings(nextSettings);
    setCustomLlmKey(nextCustomLlmKey);
    saveSettings({
      llmSource: nextSettings.llmSource,
      customLlmEndpoint: nextSettings.customLlmEndpoint,
      customLlmModel: nextSettings.customLlmModel,
    });
    await saveCustomLlmKey(nextCustomLlmKey);

    if (!hasCompleteCustomLlmConfig(nextSettings, nextCustomLlmKey)) {
      setCustomLlmStatus({ status: 'missing' });
      return;
    }

    setTestingCustomLlm(true);
    setCustomLlmStatus({ status: 'untested' });

    try {
      const valid = await testCustomLlmResponse({
        customLlmEndpoint: nextSettings.customLlmEndpoint,
        customLlmModel: nextSettings.customLlmModel,
        customLlmKey: nextCustomLlmKey,
      });
      if (customLlmTestRunRef.current !== runId) return;
      setCustomLlmStatus({ status: valid ? 'valid' : 'invalid', testedAt: new Date().toISOString() });
    } finally {
      if (customLlmTestRunRef.current === runId) {
        setTestingCustomLlm(false);
      }
    }
  }

  async function saveAndValidateCustomImageProvider(next?: Partial<Pick<AdvancedSettings, 'customImageEndpoint' | 'customImageModel'>> & { customImageKey?: string }) {
    const nextSettings = {
      ...settings,
      customImageEndpoint: next?.customImageEndpoint ?? settings.customImageEndpoint,
      customImageModel: next?.customImageModel ?? settings.customImageModel,
    };
    const nextCustomImageKey = next?.customImageKey ?? customImageKey;
    const runId = imageProviderTestRunRef.current + 1;
    imageProviderTestRunRef.current = runId;

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

    setTestingImageProvider(true);
    setImageProviderStatus({ status: 'untested' });

    try {
      const valid = await testImageProviderResponse({
        provider: 'custom',
        endpoint: nextSettings.customImageEndpoint,
        model: nextSettings.customImageModel,
        apiKey: nextCustomImageKey,
        prompt: IMAGE_PROVIDER_TEST_PROMPT,
      });
      if (imageProviderTestRunRef.current !== runId) return;
      setImageProviderStatus({ status: valid ? 'valid' : 'invalid', testedAt: new Date().toISOString() });
    } finally {
      if (imageProviderTestRunRef.current === runId) {
        setTestingImageProvider(false);
      }
    }
  }

  function reset() {
    setSettings(defaultSettings);
    setCustomLlmKey('');
    setCustomImageKey('');
    void saveCustomLlmKey('');
    void saveCustomImageKey('');
    saveSettings(defaultSettings);
    setImageProviderStatus({ status: 'missing' });
    setCustomLlmStatus({ status: 'missing' });
    setTestingImageProvider(false);
    setTestingCustomLlm(false);
    customLlmTestRunRef.current += 1;
    imageProviderTestRunRef.current += 1;
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
            <h3>{t('llmSource')}</h3>
            <p className="subtitle">{t('llmSourceCopy')}</p>
            <div className="config-grid">
              <div className="form-field">
                <span>{t('llmSource')}</span>
                <div className="language-toggle">
                  <button type="button" className={settings.llmSource === 'built-in' ? 'active' : ''} onClick={() => update('llmSource', 'built-in')}>{t('builtIn')}</button>
                  <button type="button" className={settings.llmSource === 'custom' ? 'active' : ''} onClick={() => update('llmSource', 'custom')}>{t('custom')}</button>
                </div>
              </div>
              <div>
                {settings.llmSource === 'custom' ? (
                  <label className="form-field">
                    {t('customLlmModel')}
                    <input
                      value={settings.customLlmModel}
                      onChange={(event) => updateCustomLlmSetting('customLlmModel', event.target.value)}
                      placeholder={t('customLlmModelPlaceholder')}
                    />
                  </label>
                ) : (
                  <div className="form-field">
                    <span>{t('builtInModel')}</span>
                    <SystemSelect
                      value={settings.builtInModel}
                      onChange={(nextValue) => update('builtInModel', nextValue)}
                      ariaLabel={t('builtInModel')}
                      options={elevenBuiltInModels.map((model) => ({
                        value: model.id,
                        label: `${model.provider} · ${model.label}`,
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>
            {settings.llmSource === 'custom' ? (
              <div className="image-config-stack">
                <div className="config-grid">
                  <label className="form-field">
                    {t('customLlmKey')}
                    <input value={customLlmKey} onChange={(event) => updateCustomLlmKey(event.target.value)} placeholder="sk-••••••••••••••••••••" type="password" />
                  </label>
                  <label className="form-field">
                    {t('customEndpoint')}
                    <input value={settings.customLlmEndpoint} onChange={(event) => updateCustomLlmSetting('customLlmEndpoint', event.target.value)} placeholder={t('customLlmEndpointPlaceholder')} />
                  </label>
                </div>
                <div className="provider-status-row">
                  <span className={`test-meta ${customLlmStatus.status === 'valid' ? 'valid' : ''}`}>
                    <span aria-hidden="true">●</span> {testingCustomLlm ? t('testing') : customLlmTestLabel(customLlmStatus, language, t)}
                  </span>
                  <span className={`status-badge ${customLlmStatus.status === 'valid' ? '' : 'missing'}`}>
                    {testingCustomLlm ? t('testing') : statusLabel(customLlmStatus.status, t)}
                    {customLlmStatus.status === 'valid' ? <Check size={14} /> : <span className="badge-mark">!</span>}
                  </span>
                </div>
                <div className="save-row">
                  <button className="primary-button" type="button" disabled={testingCustomLlm} onClick={() => void saveAndValidateCustomLlmProvider()}>
                    {testingCustomLlm ? t('testing') : t('saveChanges')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
        <section className="config-section">
          <span className="config-number">2</span>
          <div className="config-body">
            <h3>{t('imageProvider')}</h3>
            <p className="subtitle">{t('imageProviderCopy')}</p>
            <div className="provider-status-row">
              <span className={`test-meta ${imageProviderStatus.status === 'valid' ? 'valid' : ''}`}>
                <span aria-hidden="true">●</span> {testingImageProvider ? t('testing') : imageProviderTestLabel(imageProviderStatus, language, t)}
              </span>
              <span className={`status-badge ${imageProviderStatus.status === 'valid' ? '' : 'missing'}`}>
                {testingImageProvider ? t('testing') : statusLabel(imageProviderStatus.status, t)}
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
                <button className="primary-button" type="button" disabled={testingImageProvider} onClick={() => void saveAndValidateCustomImageProvider()}>
                  {testingImageProvider ? t('testing') : t('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="config-section">
          <span className="config-number">3</span>
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

function hasCompleteCustomLlmConfig(settings: AdvancedSettings, customLlmKey: string) {
  return Boolean(
    settings.customLlmEndpoint.trim()
    && settings.customLlmModel.trim()
    && customLlmKey.trim(),
  );
}

async function testCustomLlmResponse(config: CustomLlmConfig) {
  if (!config.customLlmEndpoint || !config.customLlmModel || !config.customLlmKey) return false;

  try {
    const response = await fetch(config.customLlmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.customLlmKey}`,
      },
      body: JSON.stringify({
        model: config.customLlmModel,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 8,
        temperature: 0,
      }),
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string }; text?: string }> } | null;
    return Boolean(data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text);
  } catch {
    return false;
  }
}

function ApiKeyCard({ row, value, visible, testing, language, t, onChange, onBlur, onToggleVisible, className = '' }: ApiKeyCardProps) {
  const logo = apiKeyLogos[row.field];

  return (
    <article className={`api-card ${className}`}>
      <div className={`api-icon api-logo-icon ${row.field === 'elevenLabs' ? 'elevenlabs-logo' : 'did-logo'}`}>
        <Image src={logo.src} alt="" aria-hidden="true" width={logo.width} height={logo.height} />
      </div>
      <div>
        <h3>{row.name} <span className="tag">{row.tag}</span></h3>
        <span className={`test-meta ${row.good ? 'valid' : ''}`}>
          <span aria-hidden="true">●</span> {testing ? t('testing') : testedLabel(row.status, row.testedAt, language, t)}
        </span>
      </div>
      <span className={`status-badge ${row.good ? '' : 'missing'}`}>
        {testing ? t('testing') : statusLabel(row.status, t)} {row.good ? <Check size={14} /> : <span className="badge-mark">!</span>}
      </span>
      <div className="api-input-row">
        <label className="secret-field">
          <LockKeyhole size={16} />
          <input
            className="secret-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onBlur(event.target.value)}
            placeholder="••••••••••••••••••••••••"
            type={visible ? 'text' : 'password'}
          />
          <button
            aria-label={visible ? t('hideKey') : t('showKey')}
            className="icon-button"
            type="button"
            onClick={onToggleVisible}
          >
            <Eye size={16} />
          </button>
        </label>
      </div>
    </article>
  );
}

function statusLabel(status: string, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'valid') return t('valid');
  if (status === 'invalid') return t('invalid');
  if (status === 'missing') return t('missing');
  return t('untested');
}

function testedLabel(status: string, testedAt: string | undefined, language: 'en' | 'zh', t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'valid' && testedAt) return `${t('lastTested')} · ${formatRelativeTime(testedAt, language)}`;
  return t('notTested');
}

function imageProviderTestLabel(status: ImageProviderStatus, language: 'en' | 'zh', t: ReturnType<typeof useLanguage>['t']) {
  if ((status.status === 'valid' || status.status === 'invalid') && status.testedAt) return `${t('lastTested')} · ${formatRelativeTime(status.testedAt, language)}`;
  if (status.status === 'missing') return t('imageConfigMissing');
  if (status.status === 'invalid') return t('invalid');
  return t('notTested');
}

function customLlmTestLabel(status: ImageProviderStatus, language: 'en' | 'zh', t: ReturnType<typeof useLanguage>['t']) {
  if ((status.status === 'valid' || status.status === 'invalid') && status.testedAt) return `${t('lastTested')} · ${formatRelativeTime(status.testedAt, language)}`;
  if (status.status === 'missing') return t('customLlmConfigMissing');
  if (status.status === 'invalid') return t('invalid');
  return t('notTested');
}

function formatRelativeTime(value: string, language: 'en' | 'zh') {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return language === 'zh' ? '刚刚' : 'just now';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return language === 'zh' ? `${minutes} 分钟前` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return language === 'zh' ? `${hours} 小时前` : `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  return language === 'zh' ? `${days} 天前` : `${days} day${days === 1 ? '' : 's'} ago`;
}
