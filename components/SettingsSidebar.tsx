import Link from 'next/link';
import { Brain, Globe2, Image as ImageIcon, KeyRound, Lock, Settings as Gear, Shield } from 'lucide-react';
import { DoodleDrawing, MagicPortal } from '@/components/Illustrations';

export function SettingsSidebar({ active }: { active: 'api' | 'advanced' }) {
  const links = [
    ['General', Gear, '#'], ['Account', Lock, '#'], ['Subscription', Shield, '#'], ['Billing', Lock, '#'], ['API Keys', KeyRound, '/settings'], ['Integrations', Gear, '#'], ['LLM & Image', Brain, '/settings/advanced'], ['Language', Globe2, '#'], ['Image Gen', ImageIcon, '#'],
  ] as const;
  return (
    <aside className="settings-sidebar card">
      <h2>⚙ Settings</h2>
      <nav className="settings-nav">
        {links.map(([label, Icon, href]) => {
          const isActive = (active === 'api' && label === 'API Keys') || (active === 'advanced' && label === 'LLM & Image');
          return <Link key={label} className={`settings-link ${isActive ? 'active' : ''}`} href={href}><Icon size={18} />{label}</Link>;
        })}
      </nav>
      <div className="sidebar-art">
        <div style={{ position: 'relative', height: 220 }}><DoodleDrawing /><MagicPortal /></div>
        <div className="privacy-box"><b>Your data, your control</b><br /><small>All API keys and preferences are stored only on your device.</small></div>
      </div>
    </aside>
  );
}
