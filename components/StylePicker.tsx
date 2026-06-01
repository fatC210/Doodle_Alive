'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DEFAULT_STYLE_ID, styles } from '@/lib/data';
import { useLanguage } from '@/lib/i18n';
import { buildImagePrompt } from '@/lib/prompt';
import { loadDraft, saveDraft } from '@/lib/storage';
import { DoodleDrawing, StyleThumb } from './Illustrations';

export function StylePicker() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedId, setSelectedId] = useState(DEFAULT_STYLE_ID);
  const [originalDataUrl, setOriginalDataUrl] = useState('');
  const [accentColors, setAccentColors] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isBlankCanvas, setIsBlankCanvas] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const draft = loadDraft();
      setSelectedId(draft.styleId ?? DEFAULT_STYLE_ID);
      setOriginalDataUrl(draft.originalDataUrl ?? '');
      setAccentColors(draft.accentColors ?? []);
      setBackgroundColor(draft.backgroundColor ?? '#ffffff');
      setIsBlankCanvas(Boolean(draft.isBlankCanvas));
    });
  }, []);

  const selected = useMemo(() => styles.find((style) => style.id === selectedId) ?? styles.find((style) => style.id === DEFAULT_STYLE_ID) ?? styles[0], [selectedId]);

  function selectStyle(styleId: string) {
    const prompt = buildImagePrompt(styleId, accentColors, backgroundColor, { isBlankCanvas });
    setSelectedId(styleId);
    saveDraft({ step: 'STYLE', styleId, prompt, styleChoiceMode: 'manual' });
  }

  function continueToMorph() {
    const style = styles.find((item) => item.id === selectedId) ?? styles.find((item) => item.id === DEFAULT_STYLE_ID) ?? styles[0];
    saveDraft({
      step: 'MORPHING',
      styleId: style.id,
      prompt: buildImagePrompt(style.id, accentColors, backgroundColor, { isBlankCanvas }),
      styleChoiceMode: 'manual',
    });
    router.push('/create/morph');
  }

  return (
    <section className="style-layout">
      <div>
        <div className="style-heading">
          <div>
            <h1 className="create-title">{t('chooseStyle')} ✨</h1>
            <p className="subtitle">{t('chooseStyleCopy')}</p>
          </div>
        </div>
        <div className="style-grid">
          {styles.map((style) => (
            <button key={style.id} className={`style-card ${style.id === selected.id ? 'selected' : ''}`} type="button" onClick={() => selectStyle(style.id)}>
              <StyleThumb tone={style.tone} image={style.image} label={language === 'zh' ? style.nameZh : style.name} selected={style.id === selected.id} />
              <div className="choice-row"><span className="radio">{style.id === selected.id ? '✓' : ''}</span>{language === 'zh' ? style.nameZh : style.name}</div>
            </button>
          ))}
        </div>
      </div>

      <aside className="preview-panel card">
        <h3>✨ {t('yourPreview')}</h3>
        <b className="preview-label">{t('originalDrawing')}</b>
        <div className="preview-frame">{originalDataUrl ? <img className="preview-image" src={originalDataUrl} alt={t('originalDrawing')} /> : <DoodleDrawing />}</div>
        <div className="style-summary">
          <span>{t('selectedStyle')}</span>
          <b>{language === 'zh' ? selected.nameZh : selected.name}</b>
          <small>{t('styleReadyCopy')}</small>
        </div>
        <div className="style-panel-actions">
          <Link className="ghost-button" href="/create?draw=1"><ArrowLeft size={18} /> {t('previousStep')}</Link>
          <button className="primary-button" type="button" onClick={continueToMorph}>{t('nextDetails')} <ArrowRight size={18} /></button>
        </div>
      </aside>
    </section>
  );
}
