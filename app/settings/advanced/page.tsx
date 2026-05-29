import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { SettingsSidebar } from '@/components/SettingsSidebar';

export default function AdvancedSettingsPage() {
  return (
    <div className="page-shell settings-layout">
      <SettingsSidebar active="advanced" />
      <section className="settings-main">
        <div className="section-row"><span><h1 className="settings-title">Advanced Configuration</h1><p className="subtitle">Configure language models and image generation to power your creations.</p></span><button className="ghost-button"><RotateCcw size={16} /> Reset to Defaults</button></div>
        <div className="advanced-content">
          <section className="config-section card"><span className="config-number">1</span><div className="config-body"><h3>LLM Source</h3><p className="subtitle">Choose between built-in models or your own custom LLM.</p><div className="config-grid"><div><label className="form-field">Built-in Model<select defaultValue="gpt-4o-mini"><option>gpt-4o-mini</option></select></label><div className="dropdown-mock"><div className="dropdown-option active">gpt-4o-mini <span className="tag">Recommended</span></div><div className="dropdown-option">gpt-4o</div><div className="dropdown-option">claude-sonnet-4</div><div className="dropdown-option">gemini-2.5-flash</div></div></div><div><div className="language-toggle"><button className="active">Built-in</button><button>Custom</button></div><div className="benefits" style={{ marginTop: 24 }}><span>No API key required</span><span>Optimized for Doodle Alive</span><span>Reliable & secure</span></div></div></div></div></section>
          <section className="config-section card"><span className="config-number">2</span><div className="config-body"><h3>Custom LLM <small>(Advanced)</small></h3><p className="subtitle">Provide your own LLM endpoint and API key.</p><div className="config-grid"><div /><div><label className="form-field">Custom LLM Key<input defaultValue="sk-••••••••••••••••••••" /></label><label className="form-field">Custom Endpoint URL<input defaultValue="https://api.your-llm-provider.com/v1/chat/completions" /></label></div></div></div></section>
          <section className="config-section card"><span className="config-number">3</span><div className="config-body"><h3>Image Generation Provider</h3><p className="subtitle">Choose how images are generated for your characters.</p><div className="config-grid"><label className="form-field">Endpoint URL<input defaultValue="https://api.your-image-provider.com/v1/generate" /></label><label className="form-field">Provider<select defaultValue="OpenAI DALL-E 3"><option>OpenAI DALL-E 3</option><option>Stability AI</option><option>Custom</option></select></label><label className="form-field">JSON Request Template<textarea className="json-box" defaultValue={'{\n  "prompt": "{{prompt}}",\n  "size": "1024x1024",\n  "style": "vivid"\n}'} /></label><label className="form-field">Response Image URL Path / JSONPath<input defaultValue="data.images[0].url" /></label></div></div></section>
          <section className="config-section card"><span className="config-number">4</span><div className="config-body"><h3>Language</h3><p className="subtitle">Set the interface language for Doodle Alive.</p><div className="language-toggle"><button className="active">EN English</button><button>中文</button></div><p className="subtitle">Language change is applied instantly.</p></div></section>
        </div>
        <div className="save-row"><Link href="/settings" className="ghost-button">API Keys</Link><button className="primary-button">✨ Save Changes</button></div>
      </section>
    </div>
  );
}

