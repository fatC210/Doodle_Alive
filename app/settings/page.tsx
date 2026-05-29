import { Check, ChevronDown, Shield, Volume2 } from 'lucide-react';
import { apiKeys } from '@/lib/data';
import { SettingsSidebar } from '@/components/SettingsSidebar';

export default function SettingsPage() {
  return (
    <div className="page-shell settings-layout">
      <SettingsSidebar active="api" />
      <section className="settings-main">
        <h1 className="settings-title">API Keys & Connections</h1>
        <p className="subtitle">Connect your favorite AI services to power voices, video and images for your characters.</p>
        <div className="warning-card card"><span>⚠️ <b>Some required API keys are missing</b><br /><small>Please add the missing keys below to unlock all features.</small><br /><a className="back-link">Show missing (2)</a></span><ChevronDown /></div>
        {apiKeys.map((key) => (
          <article className="api-card card" key={key.name}>
            <div className="api-icon">{key.icon}</div>
            <div><h3>{key.name} <span className="tag">{key.tag}</span></h3><p className="subtitle">{descriptionForKey(key.name)}</p></div>
            <span className={`status-badge ${key.good ? '' : 'missing'}`}>{key.status} {key.good ? <Check size={14} /> : '!'}</span>
            <div className="api-input-row"><input className="secret-input" defaultValue="••••••••••••••••••••••••" /><button className="outline-button"><Volume2 size={18} /> Test</button></div>
            <span style={{ gridColumn: '2 / -1', color: key.good ? 'var(--green)' : 'var(--warning)', fontWeight: 900 }}>● {key.note}</span>
          </article>
        ))}
        <div className="safe-card card"><Shield color="var(--purple)" /><span><b>Your keys are safe and private</b><br />All API keys are stored locally on your device using AES-GCM encryption. We never see or transmit your keys.</span><span>🔐✨</span></div>
        <div className="save-row"><button className="ghost-button">Reset to Defaults</button><button className="primary-button">💾 Save All Changes</button></div>
      </section>
    </div>
  );
}

function descriptionForKey(name: string) {
  if (name.startsWith('Eleven')) return 'ElevenLabs powers the realistic and expressive voices for your talking characters.';
  if (name.startsWith('D-ID')) return 'D-ID brings your characters to life with realistic face animation and video.';
  return 'Generate character art and scenes using powerful image generation models.';
}



