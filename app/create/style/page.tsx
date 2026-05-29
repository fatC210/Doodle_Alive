import Link from 'next/link';
import { Box, Sparkles } from 'lucide-react';
import { DoodleDrawing, StyleThumb } from '@/components/Illustrations';
import { styles } from '@/lib/data';

export default function StylePage() {
  return (
    <div className="page-shell">
      <div className="wizard-head">
        <span className="step-dot done">✓</span><b>Character</b><span className="step-line" />
        <span className="step-dot active">2</span><b>Style</b><span className="step-line" />
        <span className="step-dot">3</span><b>Details</b><span className="step-line" />
        <span className="step-dot">4</span><b>Review</b>
      </div>

      <section className="style-layout">
        <div>
          <h1 className="create-title">Choose a style ✨</h1>
          <p className="subtitle">Pick a style to transform your drawing into something amazing.</p>
          <div className="style-grid">
            {styles.map((style, index) => (
              <article key={style.name} className={`style-card ${index === 0 ? 'selected' : ''}`}>
                <StyleThumb tone={style.tone} selected={index === 0} />
                <div className="choice-row"><span className="radio">{index === 0 ? '✓' : ''}</span>{style.name}</div>
              </article>
            ))}
          </div>
          <button className="ghost-button random-button"><Box size={18} /> Random</button>
        </div>

        <aside className="preview-panel card">
          <h3>✨ Your Preview</h3>
          <b>Original Drawing</b>
          <div className="preview-frame"><DoodleDrawing /></div>
          <div className="preview-arrow">↓</div>
          <b>Selected Style</b>
          <StyleThumb tone="pixar" selected />
          <div className="preview-selected">
            <h3>Pixar 3D</h3>
            <p className="subtitle">Bright, soft, and full of life. Brings your character into a 3D animated world.</p>
          </div>
          <Link href="/create/morph" className="primary-button" style={{ width: '100%' }}><Sparkles size={18} /> Bring to Life</Link>
        </aside>
      </section>

      <div className="bottom-nav">
        <Link className="ghost-button" href="/create">← Back</Link>
        <span className="progress-note">Step 2 of 4</span>
        <Link className="primary-button" href="/create/morph">Next: Details →</Link>
      </div>
    </div>
  );
}
