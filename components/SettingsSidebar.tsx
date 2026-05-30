'use client';

import Link from 'next/link';
import { Brain, Globe2, Image as ImageIcon, KeyRound, Settings as Gear } from 'lucide-react';
import { DoodleDrawing, MagicPortal } from '@/components/Illustrations';
import { useLanguage } from '@/lib/i18n';

type SettingsSection = 'api' | 'llm' | 'imageGen' | 'language';

export function SettingsSidebar({ active }: { active: SettingsSection }) {
  const { t } = useLanguage();
  const links = [
    [t('apiKeys'), 'api', KeyRound, '/settings'],
    ['LLM', 'llm', Brain, '/settings/advanced'],
    [t('imageGen'), 'imageGen', ImageIcon, '/settings/advanced'],
    [t('language'), 'language', Globe2, '/settings/advanced'],
  ] as const;
  return (
    <aside className="settings-sidebar card">
      <h2><Gear size={24} /> {t('settings')}</h2>
      <nav className="settings-nav">
        {links.map(([label, id, Icon, href]) => {
          const isActive = active === id;
          return <Link key={label} className={`settings-link ${isActive ? 'active' : ''}`} href={href}><Icon size={18} />{label}</Link>;
        })}
      </nav>
      <div className="sidebar-art">
        <div style={{ position: 'relative', height: 220 }}><DoodleDrawing /><MagicPortal /></div>
        <div className="privacy-box"><b>{t('dataControl')}</b><br /><small>{t('dataControlCopy')}</small></div>
      </div>
    </aside>
  );
}
