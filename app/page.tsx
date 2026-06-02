'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Shield, Sparkles, Cloud } from 'lucide-react';
import { HomeCharacters } from '@/components/HomeCharacters';
import { useLanguage } from '@/lib/i18n';

export default function HomePage() {
  const [characterCount, setCharacterCount] = useState(0);
  const handleCountChange = useCallback((count: number) => setCharacterCount(count), []);
  const { t } = useLanguage();

  return (
    <div className="page-shell home-shell">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>{t('homeHeroTitle').split('\n').map((line, index) => <span key={line}>{line}{index === 0 ? <br /> : null}</span>)}</h1>
          <p>{t('homeHeroCopy')}</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/create?new=1"><Sparkles size={20} /> {t('newCharacter')}</Link>
          </div>
        </div>
        <div className="hero-art" role="img" aria-label={t('heroArtAria')} />
      </section>

      <section className="my-characters">
        <div className="section-row">
          <h2>{t('myCharacters')} <span className="count-badge">{characterCount}</span></h2>
        </div>
        <HomeCharacters onCountChange={handleCountChange} />
      </section>

      <section className="feature-strip card">
        <div className="feature-item"><span className="feature-icon"><Shield /></span><span><b>{t('safeKidFriendly')}</b>{t('safeKidFriendlyCopy')}</span></div>
        <div className="feature-item"><span className="feature-icon"><Cloud /></span><span><b>{t('savedLocally')}</b>{t('savedLocallyCopy')}</span></div>
        <div className="feature-item"><span className="feature-icon"><Sparkles /></span><span><b>{t('tip')}</b>{t('homeTipCopy')}</span></div>
      </section>
    </div>
  );
}
