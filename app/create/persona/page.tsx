import Link from 'next/link';
import { Box, Sparkles } from 'lucide-react';
import { DoodleDrawing, MagicPortal } from '@/components/Illustrations';
import { personas } from '@/lib/data';

export default function PersonaPage() {
  return (
    <div className="page-shell">
      <div className="wizard-head">
        <span className="step-dot done">✓</span><b>1. Style</b><span className="step-line" />
        <span className="step-dot done">✓</span><b>2. Appearance</b><span className="step-line" />
        <span className="step-dot done">✓</span><b>3. Name</b><span className="step-line" />
        <span className="step-dot active">4</span><b>4. Persona</b>
      </div>

      <section className="persona-layout">
        <div>
          <h1 className="create-title">Choose a personality ✨</h1>
          <p className="subtitle">Personality controls how your character talks, reacts, and expresses themselves.</p>
          <div className="persona-grid">
            {personas.map((persona, index) => (
              <article key={persona.name} className={`persona-card ${index === 4 ? 'selected' : ''}`}>
                {index === 4 ? <span className="selected-check">✓</span> : null}
                <div className="persona-emoji">{persona.icon}</div>
                <h3>{persona.name}</h3>
                <p>{persona.desc}</p>
                <span className="voice-chip">🎙 {persona.voice}</span>
              </article>
            ))}
          </div>
        </div>
        <aside className="preview-panel card">
          <h3>✨ Your Character Preview</h3>
          <div className="preview-frame" style={{ position: 'relative' }}><DoodleDrawing /><MagicPortal /></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>Selected Style</b><div className="voice-chip" style={{ marginTop: 12 }}>✨ Watercolor</div></div>
          <div className="settings-card" style={{ padding: 18, marginTop: 20 }}><b>Selected Persona</b><div className="choice-row"><span className="persona-emoji" style={{ width: 58, height: 58, fontSize: 34 }}>😎</span><span><b>Cool Rebel</b><br /><span className="voice-chip">Cool voice</span></span></div></div>
        </aside>
      </section>

      <div className="bottom-nav">
        <Link className="outline-button" href="/create/morph">← Back</Link>
        <button className="ghost-button"><Box size={18} /> Skip for Random</button>
        <Link className="primary-button" href="/chat/lumi"><Sparkles size={18} /> Start Chatting →</Link>
      </div>
      <div className="info-bar">🔒 You can change this later anytime in settings.</div>
    </div>
  );
}
