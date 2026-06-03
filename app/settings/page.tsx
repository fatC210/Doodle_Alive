'use client';

import { AdvancedSettingsForm, ApiKeysForm, SettingsResetButton } from '@/components/SettingsForms';
import { useLanguage } from '@/lib/i18n';

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="page-shell settings-layout single-settings-layout">
      <section className="settings-main">
        <div className="settings-page-header">
          <div className="settings-title-row">
            <h1 className="settings-title">{t('settings')}</h1>
            <SettingsResetButton />
          </div>
          <p className="subtitle">{t('dataControlCopy')}</p>
        </div>
        <div className="settings-content-grid">
          <ApiKeysForm />
          <AdvancedSettingsForm />
        </div>
      </section>
    </div>
  );
}
