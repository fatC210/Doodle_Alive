'use client';

import { AdvancedSettingsForm, ApiKeysForm } from '@/components/SettingsForms';
import { useLanguage } from '@/lib/i18n';

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <div className="page-shell settings-layout single-settings-layout">
      <section className="settings-main">
        <div className="settings-page-header">
          <span>
            <h1 className="settings-title">{t('settings')}</h1>
            <p className="subtitle">{t('dataControlCopy')}</p>
          </span>
        </div>
        <div className="settings-content-grid">
          <ApiKeysForm />
          <AdvancedSettingsForm />
        </div>
      </section>
    </div>
  );
}
