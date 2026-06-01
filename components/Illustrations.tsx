import type { ReactNode } from 'react';

type Tone = 'mint' | 'dino' | 'space' | 'panda' | 'cat' | 'unicorn' | string;

export function CharacterAvatar({ tone = 'mint', size = 'md' }: { tone?: Tone; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <div className={`avatar-art avatar-${tone} avatar-${size}`}>
      <span className="avatar-glow" />
      <span className="avatar-face">{faceForTone(tone)}</span>
    </div>
  );
}

export function DoodleDrawing({ variant = 'boy' }: { variant?: 'boy' | 'lumi' }) {
  return (
    <div className={`doodle-paper ${variant}`}>
      <div className="doodle-head">
        <span className="hair hair-a" />
        <span className="hair hair-b" />
        <span className="ear left" />
        <span className="ear right" />
        <span className="eye left" />
        <span className="eye right" />
        <span className="nose" />
        <span className="cheek left" />
        <span className="cheek right" />
        <span className="smile" />
      </div>
      <div className="doodle-shirt" />
    </div>
  );
}

export function MagicPortal({ children }: { children?: ReactNode }) {
  return (
    <div className="portal-wrap">
      <div className="portal-ring" />
      <div className="portal-spark s1">✦</div>
      <div className="portal-spark s2">✧</div>
      <div className="portal-spark s3">✶</div>
      {children}
    </div>
  );
}

export function StyleThumb({ tone, image, label, selected }: { tone: string; image: string; label: string; selected?: boolean }) {
  return (
    <div className={`style-thumb ${tone} ${selected ? 'selected' : ''}`}>
      <img src={image} alt={label} />
    </div>
  );
}

export function Waveform() {
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: 35 }).map((_, index) => (
        <span key={index} style={{ '--h': `${18 + ((index * 13) % 48)}px` } as React.CSSProperties} />
      ))}
    </div>
  );
}

function faceForTone(tone: Tone) {
  if (tone === 'dino') return '🦖';
  if (tone === 'space') return '🧑‍🚀';
  if (tone === 'panda') return '🐼';
  if (tone === 'cat') return '🐱';
  if (tone === 'unicorn') return '🦄';
  return '🌿';
}
