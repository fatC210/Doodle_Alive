'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Sparkles } from 'lucide-react';
import { pickRandomStyle, styles } from '@/lib/data';
import { useLanguage } from '@/lib/i18n';
import { buildImagePrompt } from '@/lib/prompt';
import { loadDraft, saveDraft } from '@/lib/storage';
import { DoodleDrawing, StyleThumb } from './Illustrations';

export function StylePicker() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedId, setSelectedId] = useState(styles[0].id);
  const [originalDataUrl, setOriginalDataUrl] = useState('');
  const [accentColors, setAccentColors] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      setSelectedId(draft.styleId ?? styles[0].id);
      setOriginalDataUrl(draft.originalDataUrl ?? '');
      setAccentColors(draft.accentColors ?? []);
      setBackgroundColor(draft.backgroundColor ?? '#ffffff');
      setIsBlankCanvas(Boolean(draft.isBlankCanvas));
    });
  }, []);

  const selected = useMemo(() => styles.find((style) => style.id === selectedId) ?? styles[0], [selectedId]);

  function selectStyle(styleId: string) {
    const prompt = buildImagePrompt(styleId, accentColors, backgroundColor, { isBlankCanvas });
    setSelectedId(styleId);
    saveDraft({ step: 'STYLE', styleId, prompt });
  }

  function randomStyle() {
    const style = pickRandomStyle();
    selectStyle(style.id);
  }

  function continueToMorph() {
    const style = styles.find((item) => item.id === selectedId) ?? pickRandomStyle();
    saveDraft({
      step: 'MORPHING',
      styleId: style.id,
      prompt: buildImagePrompt(style.id, accentColors, backgroundColor, { isBlankCanvas }),
    });
    router.push('/create/morph');
  }

  return (
    <>
      <section className="style-layout">
        <div>
          <h1 className="create-title">{t('chooseStyle')} ✨</h1>
          <p className="subtitle">{t('chooseStyleCopy')}</p>
          <div className="style-grid">
            {styles.map((style) => (
              <button key={style.id} className={`style-card ${style.id === selected.id ? 'selected' : ''}`} type="button" onClick={() => selectStyle(style.id)}>
                <StyleThumb tone={style.tone} selected={style.id === selected.id} />
                <div className="choice-row"><span className="radio">{style.id === selected.id ? '✓' : ''}</span>{language === 'zh' ? style.nameZh : style.name}</div>
              </button>
            ))}
          </div>
          <button className="ghost-button random-button" type="button" onClick={randomStyle}><Box size={18} /> {t('random')}</button>
        </div>

        <aside className="preview-panel card">
          <h3>✨ {t('yourPreview')}</h3>
          <b>{t('originalDrawing')}</b>
          <div className="preview-frame">{originalDataUrl ? <img className="preview-image" src={originalDataUrl} alt={t('originalDrawing')} /> : <DoodleDrawing />}</div>
          <div className="preview-arrow">↓</div>
          <b>{t('selectedStyle')}</b>
          <StyleThumb tone={selected.tone} selected />
          <div className="preview-selected">
            <h3>{language === 'zh' ? selected.nameZh : selected.name}</h3>
            <p className="subtitle">{selected.desc}</p>
          </div>
          <button className="primary-button" style={{ width: '100%' }} type="button" onClick={continueToMorph}><Sparkles size={18} /> {t('bringToLife')}</button>
        </aside>
      </section>

      <div className="bottom-nav">
        <Link className="ghost-button" href="/create">← {t('back')}</Link>
        <span className="progress-note">{t('step2Of4')}</span>
        <button className="primary-button" type="button" onClick={continueToMorph}>{t('nextDetails')} →</button>
      </div>
    </>
  );
}
