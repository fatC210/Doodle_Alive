'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Wand2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getCharacters } from '@/lib/storage';
import type { DoodleCharacter } from '@/lib/types';
import { CharacterAvatar } from './Illustrations';

const CHARACTERS_PER_PAGE = 5;

export function HomeCharacters({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [characters, setCharacters] = useState<DoodleCharacter[] | null>(null);
  const [page, setPage] = useState(0);
  const { language, t } = useLanguage();

  useEffect(() => {
    getCharacters().then((items) => {
      const sorted = items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setCharacters(sorted);
      setPage(0);
      onCountChange?.(sorted.length);
    });
  }, [onCountChange]);

  if (characters === null) {
    return (
      <div className="character-grid">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="character-card loading-card" />)}
      </div>
    );
  }

  if (!characters.length) {
    return (
      <Link href="/create" className="character-card empty-state">
        <span className="primary-button small">+ {t('newCharacter')}</span>
      </Link>
    );
  }

  const totalPages = Math.ceil(characters.length / CHARACTERS_PER_PAGE);
  const pageStart = page * CHARACTERS_PER_PAGE;
  const visibleCharacters = characters.slice(pageStart, pageStart + CHARACTERS_PER_PAGE);

  return (
    <>
      <div className="character-grid">
        {visibleCharacters.map((character, index) => {
          const characterIndex = pageStart + index;
          return (
            <article key={character.id} className={`character-card ${characterIndex === 0 ? 'featured' : ''}`}>
              {characterIndex === 0 ? <span className="new-ribbon">✨ {t('newBadge')}</span> : null}
              {character.generatedDataUrl ? <img className="stored-avatar" src={character.generatedDataUrl} alt={character.name} /> : <CharacterAvatar tone={character.tone || 'mint'} size="md" />}
              <div className="character-meta">
                <h3>{character.name}</h3>
                <div className="tag-row">
                  <span className="tag">{character.styleName}</span>
                  <span className={`tag ${characterIndex % 3 === 0 ? 'green' : characterIndex % 3 === 1 ? 'orange' : 'blue'}`}>{character.personaName}</span>
                </div>
                <div className="meta-date">{formatDate(character.createdAt, language, t)}</div>
                <Link href={`/chat/${character.id}`} className="card-cta"><MessageCircle size={15} /> {t('continueChat')}</Link>
              </div>
              <span className="card-menu">⋮</span>
            </article>
          );
        })}
        <Link href="/create" className="character-card new-card">
          <span className="wand"><Wand2 size={56} /></span>
          <b>{t('createNewCharacter')}</b>
          <small>{t('createNewCharacterCopy')}</small>
          <span className="primary-button small">+ {t('newCharacter')}</span>
        </Link>
      </div>
      {totalPages > 1 ? (
        <nav className="pagination-row" aria-label={t('characterPages')}>
          <button className="outline-button pagination-button" type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label={t('previousPage')} title={t('previousPage')}>
            <ChevronLeft size={18} />
          </button>
          <span className="page-indicator">{page + 1} / {totalPages}</span>
          <button className="outline-button pagination-button" type="button" disabled={page === totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} aria-label={t('nextPage')} title={t('nextPage')}>
            <ChevronRight size={18} />
          </button>
        </nav>
      ) : null}
    </>
  );
}

function formatDate(value: string, language: 'en' | 'zh', t: ReturnType<typeof useLanguage>['t']) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('createdRecently');
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `${t('createdToday')} · ${date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${t('created')} ${date.toLocaleDateString(language === 'zh' ? 'zh-CN' : undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
