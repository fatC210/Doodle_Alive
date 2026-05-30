'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Palette, Sparkles, Trash2, UserRoundCheck } from 'lucide-react';
import { styles } from '@/lib/data';
import { useLanguage } from '@/lib/i18n';
import { generateCharacterImage } from '@/lib/image-gen';
import { loadCustomImageKey, loadSecretKeys, missingRequiredKeys } from '@/lib/secrets';
import { validateDidAvatarForGeneratedImage } from '@/lib/settings-validation';
import { dataUrlToBlob, loadDraft, loadSettings, saveDraft } from '@/lib/storage';
import { CharacterAvatar, DoodleDrawing, MagicPortal } from './Illustrations';

const steps = [
  ['removeGuideLayer', Trash2],
  ['analyzeColors', Palette],
  ['generateCharacter', Sparkles],
  ['validateFace', UserRoundCheck],
] as const;

export function MorphingExperience() {
  const { t } = useLanguage();
  const tRef = useRef(t);
  const [originalDataUrl, setOriginalDataUrl] = useState('');
  const [generatedDataUrl, setGeneratedDataUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState(t('preparingCharacter'));
  const [accentColors, setAccentColors] = useState<string[]>(['#3d72e8', '#a879df', '#ff8d91']);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(true);
  const style = useMemo(() => {
    const draft = loadDraft();
    return styles.find((item) => item.id === draft.styleId) ?? styles[0];
  }, []);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const tx = tRef.current;
      const draft = loadDraft();
      setOriginalDataUrl(draft.originalDataUrl ?? '');
      setAccentColors(draft.accentColors?.length ? draft.accentColors : ['#3d72e8', '#a879df', '#ff8d91']);
      const settings = loadSettings();
      const keys = await loadSecretKeys();
      const imageKey = await loadCustomImageKey();
      try {
        const missing = missingRequiredKeys(keys);
        if (!imageKey) {
          throw new Error(tx('imageKeyMissing'));
        }
        for (let index = 0; index < steps.length; index += 1) {
          if (cancelled) return;
          setActiveStep(index);
          await new Promise((resolve) => window.setTimeout(resolve, index === 2 ? 300 : 260));
          if (index === 2) {
            setStatusMessage(tx('generatingAvatar'));
            const result = await generateCharacterImage({
              prompt: draft.prompt || '',
              sourceImageDataUrl: draft.originalDataUrl,
              provider: settings.imageProvider,
              model: settings.customImageModel,
              apiKey: imageKey,
              endpoint: settings.customImageEndpoint,
              timeoutMs: 30000,
            });
            const dataUrl = result.imageDataUrl || (result.blob ? await blobToDataUrl(result.blob) : '');
            if (!dataUrl) throw new Error(tx('noGeneratedImage'));
            if (!cancelled) {
              setGeneratedDataUrl(dataUrl);
              saveDraft({ generatedDataUrl: dataUrl, generatedImageUrl: result.imageUrl });
              if (result.imageUrl && !result.blob) {
                const blob = await dataUrlToBlob(dataUrl);
                await blob.arrayBuffer();
              }
            }
          }
          if (index === 3) {
            setStatusMessage(tx('checkingDid'));
            if (missing.did) {
              throw new Error(tx('didKeyMissing'));
            }
            const currentDraft = loadDraft();
            const didResult = await validateDidAvatarForGeneratedImage({
              didKey: keys.did,
              imageProvider: settings.imageProvider,
              generatedImageUrl: currentDraft.generatedImageUrl,
            });
            if (!didResult.ok) {
              saveDraft({
                step: 'DRAW',
                didValidationStatus: 'failed',
                didValidationMessage: didResult.message,
                avatarId: undefined,
                didStreamId: undefined,
                avatarSourceUrl: undefined,
              });
              throw new Error(didResult.message);
            }
            saveDraft({
              step: 'PERSONA',
              avatarId: didResult.avatarId,
              didStreamId: didResult.streamId,
              avatarSourceUrl: didResult.avatarSourceUrl,
              didValidationStatus: didResult.status,
              didValidationMessage: didResult.message,
            });
            setStatusMessage(didResult.message);
          }
        }
        if (!cancelled) setWorking(false);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : tx('magicFailedShort'));
          setWorking(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1 className="create-title">{t('magicMorphing')} ✨</h1>
      <p className="subtitle">{t('morphingCopy')} ✨</p>

      <section className="morph-stage">
        <article className="morph-card">{originalDataUrl ? <img className="morph-image" src={originalDataUrl} alt={t('yourDrawing')} /> : <DoodleDrawing />}<b>{t('yourDrawing')}</b></article>
        <div className={`big-arrow ${working ? 'morphing' : ''}`}>→<MagicPortal /></div>
        <article className="morph-card result-card">{generatedDataUrl ? <img className="morph-image breathing" src={generatedDataUrl} alt={t('yourNewCharacter')} /> : <CharacterAvatar tone={style.tone} size="xl" />}<b>{t('yourNewCharacter')}</b></article>
      </section>

      <section className="morph-info">
        <div className="timeline card">
          <h3>{working ? t('morphingProgress') : error ? t('morphingNeedsAttention') : t('morphingComplete')}</h3>
          {steps.map(([labelKey, Icon], index) => (
            <div className="timeline-row" key={labelKey}>
              <span className="timeline-icon"><Icon size={20} /></span>
              <span><b>{t(labelKey)}</b><small className={error && index === activeStep ? 'status-error' : 'status-ok'}>{error && index === activeStep ? t('needsRetry') : index <= activeStep && !error ? t('completed') : index === activeStep ? t('working') : t('waiting')}</small></span>
              {index <= activeStep && !error ? <CheckCircle className="status-ok" /> : <span />}
            </div>
          ))}
        </div>
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h3>{t('extractedColors')}</h3>
            <div className="accent-colors">
              {accentColors.map((color) => <span key={color} className="accent" style={{ background: color }} />)}
            </div>
          </div>
          <div className={`ready-card card ${error ? 'error-card' : ''}`}>
            <span className="check-big">{error ? '!' : '✓'}</span>
            <span><h2>{error ? t('magicFailedPath') : t('characterReady')}</h2><b>{error || statusMessage}</b><p className="subtitle">{error ? t('retryCopy') : t('readyChatCopy')}</p></span>
            <div className="ready-actions">{error.includes('API key') || error.includes('API Key') || error.includes('密钥') ? <Link className="outline-button" href="/settings">{t('openSettings')}</Link> : null}<Link className="ghost-button" href="/create">← {t('backToDrawing')}</Link><Link className={`primary-button ${working || error ? 'disabled' : ''}`} href={working || error ? '/create/morph' : '/create/persona'}>{t('continueFinal')} →</Link></div>
          </div>
        </div>
      </section>
      <div className="info-bar">ⓘ {t('validationInfo')}</div>
    </>
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
