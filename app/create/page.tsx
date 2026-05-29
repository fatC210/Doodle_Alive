import Link from 'next/link';
import { Brush, Eraser, Eye, RotateCcw, Sparkles, Target, Upload } from 'lucide-react';
import { DoodleDrawing } from '@/components/Illustrations';

const colors = ['#ff4545', '#ff982d', '#ffe122', '#78d843', '#12b6a5', '#1376d8', '#ff5fae', '#7b482a', '#151515', '#f8fbff'];
const backgrounds = ['#ffffff', '#ffdce8', '#fff6bf', '#dff8e6', '#d9f3ff', '#eee5ff'];

export default function CreatePage() {
  return (
    <div className="page-shell">
      <div className="wizard-head">
        <span className="step-dot active">1</span><b>Draw</b><span className="step-line" />
        <span className="step-dot">2</span><b>Style</b><span className="step-line" />
        <span className="step-dot">3</span><b>Magic</b><span className="step-line" />
        <span className="step-dot">4</span><b>Persona</b>
      </div>

      <section className="wizard-card">
        <div className="draw-area">
          <div className="canvas-panel">
            <div className="tab-row">
              <button className="tab-button active"><Brush size={18} /> Draw on Canvas</button>
              <button className="tab-button"><Upload size={18} /> Upload Photo</button>
            </div>
            <div className="canvas-box"><DoodleDrawing /></div>
            <div className="toolbox">
              <div>
                <b>Colors</b>
                <div className="swatches">{colors.map((color) => <span key={color} className="swatch" style={{ background: color }} />)}</div>
              </div>
              <div className="tool-mini"><b>Brush Size</b><div><span className="swatch" style={{ background: '#7c3cff' }} /></div></div>
              <div className="tool-mini"><b>Eraser</b><div><Eraser /></div></div>
              <div className="tool-mini"><b>Undo</b><div><RotateCcw /></div></div>
            </div>
            <div style={{ marginTop: 18 }}>
              <b>Background</b>
              <div className="bg-swatches">{backgrounds.map((color) => <span key={color} className="bg-swatch" style={{ background: color }} />)}</div>
            </div>
          </div>

          <aside className="tips-panel card">
            <h3>✨ Tips for the best avatar</h3>
            <div className="tip-item"><span className="tip-icon"><Target /></span><span><h4>Center the face</h4><p>Keep the face in the middle of the canvas.</p></span></div>
            <div className="tip-item"><span className="tip-icon">▢</span><span><h4>Leave a little margin</h4><p>Avoid drawing too close to the edges.</p></span></div>
            <div className="tip-item"><span className="tip-icon"><Eye /></span><span><h4>Draw open eyes</h4><p>Open eyes help bring your character to life.</p></span></div>
            <div className="tip-item"><span className="tip-icon">🎨</span><span><h4>Use clear colors</h4><p>Bright and clear colors look amazing in magic.</p></span></div>
            <div className="dashed-note"><Sparkles size={20} /> Guide layer will be removed automatically.</div>
            <div className="bottom-nav">
              <button className="ghost-button">🗑 Clear</button>
              <Link href="/create/style" className="primary-button">Continue to Style →</Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
