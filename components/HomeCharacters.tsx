'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Trash2, Wand2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { deleteCharacter, getCharacters } from '@/lib/storage';
import type { DoodleCharacter } from '@/lib/types';
import { CharacterAvatar } from './Illustrations';

const CHARACTERS_PER_PAGE = 5;

export function HomeCharacters({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [characters, setCharacters] = useState<DoodleCharacter[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const { t } = useLanguage();

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
      <Link href="/create?new=1" className="character-card empty-state">
        <span className="primary-button small">+ {t('newCharacter')}</span>
      </Link>
    );
  }

  const totalPages = Math.ceil(characters.length / CHARACTERS_PER_PAGE);
  const pageStart = page * CHARACTERS_PER_PAGE;
  const visibleCharacters = characters.slice(pageStart, pageStart + CHARACTERS_PER_PAGE);

  async function handleDeleteCharacter(character: DoodleCharacter) {
    if (!characters || deletingId) return;
    const currentCharacters = characters;
    if (!window.confirm(t('deleteCharacterConfirm'))) return;
    setDeletingId(character.id);
    try {
      await deleteCharacter(character.id);
      const nextCharacters = currentCharacters.filter((item) => item.id !== character.id);
      setCharacters(nextCharacters);
      setPage(Math.min(page, Math.max(0, Math.ceil(nextCharacters.length / CHARACTERS_PER_PAGE) - 1)));
      onCountChange?.(nextCharacters.length);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="character-grid">
        {visibleCharacters.map((character, index) => {
          const characterIndex = pageStart + index;
          return (
            <article key={character.id} className={`character-card gallery-character-card ${characterIndex === 0 ? 'featured' : ''}`}>
              <div className="gallery-avatar-frame">
                {character.generatedDataUrl ? <img className="stored-avatar gallery-avatar" src={character.generatedDataUrl} alt={character.name} /> : <CharacterAvatar tone={character.tone || 'mint'} size="lg" />}
              </div>
              <div className="character-meta">
                <h3>{character.name}</h3>
                <div className="character-actions">
                  <Link href={`/chat/${character.id}`} className="voice-chip character-chat-chip"><MessageCircle size={15} /> {t('continueChat')}</Link>
                  <button className="icon-button character-delete-button" type="button" onClick={() => handleDeleteCharacter(character)} disabled={Boolean(deletingId)} aria-label={t('deleteCharacter')} title={t('deleteCharacter')}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        <Link href="/create?new=1" className="character-card new-card">
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
