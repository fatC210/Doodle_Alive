import Link from 'next/link';
import { CheckCircle, Palette, Sparkles, Trash2, UserRoundCheck } from 'lucide-react';
import { CharacterAvatar, DoodleDrawing, MagicPortal } from '@/components/Illustrations';

const steps = [
  ['Remove guide layer', Trash2],
  ['Analyze colors', Palette],
  ['Generate character', Sparkles],
  ['Validate face', UserRoundCheck],
];

export default function MorphPage() {
  return (
    <div className="page-shell morph-page">
      <div className="wizard-head">
        <span className="step-dot">1</span><b>Choose Style</b><span className="step-line" />
        <span className="step-dot">2</span><b>Draw Your Character</b><span className="step-line" />
        <span className="step-dot active">3</span><b>Magic Morphing</b><span className="step-line" />
        <span className="step-dot">4</span><b>Final Touches</b>
      </div>

      <h1 className="create-title">Magic Morphing ✨</h1>
      <p className="subtitle">Turning your drawing into a living character ✨</p>

      <section className="morph-stage">
        <article className="morph-card"><DoodleDrawing /><b>Your Drawing</b></article>
        <div className="big-arrow">→<MagicPortal /></div>
        <article className="morph-card"><CharacterAvatar tone="space" size="xl" /><b>Your New Character</b></article>
      </section>

      <section className="morph-info">
        <div className="timeline card">
          <h3>Morphing in progress...</h3>
          {steps.map(([label, Icon]) => (
            <div className="timeline-row" key={label as string}>
              <span className="timeline-icon"><Icon size={20} /></span>
              <span><b>{label as string}</b><small className="status-ok">Completed</small></span>
              <CheckCircle className="status-ok" />
            </div>
          ))}
        </div>
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h3>Extracted accent colors</h3>
            <div className="accent-colors">
              {['#3d72e8', '#a879df', '#ff8d91', '#ffc35f', '#a9d2f6'].map((color) => <span key={color} className="accent" style={{ background: color }} />)}
            </div>
          </div>
          <div className="ready-card card">
            <span className="check-big">✓</span>
            <span><h2>Your character is ready!</h2><b>Avatar validation succeeded 🎉</b><p className="subtitle">Your character looks great and is ready to chat.</p></span>
            <div className="ready-actions"><Link className="ghost-button" href="/create">← Back to Drawing</Link><Link className="primary-button" href="/create/persona">Continue to Final Touches →</Link></div>
          </div>
        </div>
      </section>
      <div className="info-bar">ⓘ If validation fails, you can redraw or change style to get a better result.</div>
    </div>
  );
}
