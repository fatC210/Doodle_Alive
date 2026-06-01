'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, CircleCheck, Image as ImageIcon, Info, Palette, RefreshCw, Smile, Sparkles, Trash2 } from 'lucide-react';
import { getMorphingConfigIssues, type ConfigIssue } from '@/lib/config-requirements';
import { useLanguage } from '@/lib/i18n';
import { generateCharacterImage } from '@/lib/image-gen';
import { loadCustomImageKey, loadSecretKeys } from '@/lib/secrets';
import { validateDidAvatarForGeneratedImage } from '@/lib/settings-validation';
import { dataUrlToBlob, loadDraft, loadSettings, saveDraft } from '@/lib/storage';
import { DoodleDrawing } from './Illustrations';

const MORPH_STEP_COUNT = 4;
const GENERATE_STEP_INDEX = 2;
const FALLBACK_ACCENT_COLORS = ['#3867e8', '#a675df', '#ff8a8a', '#ffc060', '#9bc8f5'];

export function MorphingExperience() {
  const { t } = useLanguage();
  const tRef = useRef(t);
  const [originalDataUrl, setOriginalDataUrl] = useState('');
  const [generatedDataUrl, setGeneratedDataUrl] = useState('');
  const [accentColors, setAccentColors] = useState<string[]>(FALLBACK_ACCENT_COLORS);
  const [statusMessage, setStatusMessage] = useState(t('preparingCharacter'));
  const [error, setError] = useState('');
  const [configIssue, setConfigIssue] = useState<ConfigIssue | ''>('');
  const [working, setWorking] = useState(true);
  const [activeMorphStep, setActiveMorphStep] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const tx = tRef.current;
      const draft = loadDraft();
      setOriginalDataUrl(draft.originalDataUrl ?? '');
      setAccentColors(draft.accentColors?.length ? draft.accentColors.slice(0, 5) : FALLBACK_ACCENT_COLORS);
      setGeneratedDataUrl('');
      setStatusMessage(tx('preparingCharacter'));
      setError('');
      setConfigIssue('');
      setWorking(true);
      setActiveMorphStep(0);
      const settings = loadSettings();
      const keys = await loadSecretKeys();
      const imageKey = await loadCustomImageKey();
      try {
        setConfigIssue('');
        const configIssues = getMorphingConfigIssues(settings, keys, imageKey);
        if (configIssues.length) {
          const firstIssue = configIssues[0];
          setConfigIssue(firstIssue);
          throw new Error(morphingConfigMessage(firstIssue, tx));
        }
        for (let index = 0; index < MORPH_STEP_COUNT; index += 1) {
          if (cancelled) return;
          setActiveMorphStep(index);
          await new Promise((resolve) => window.setTimeout(resolve, index === GENERATE_STEP_INDEX ? 300 : 260));
          if (index === GENERATE_STEP_INDEX) {
            setStatusMessage(tx('generatingAvatar'));
            const result = await generateCharacterImage({
              prompt: draft.prompt || '',
              sourceImageDataUrl: draft.originalDataUrl,
              provider: settings.imageProvider,
              model: settings.customImageModel,
              apiKey: imageKey,
              endpoint: settings.customImageEndpoint,
            });
            const dataUrl = result.imageDataUrl || (result.blob ? await blobToDataUrl(result.blob) : '');
            const previewUrl = dataUrl || result.imageUrl || '';
            if (!previewUrl) throw new Error(tx('noGeneratedImage'));
            if (!cancelled) {
              setGeneratedDataUrl(previewUrl);
              saveDraft({
                step: 'PERSONA',
                generatedDataUrl: previewUrl,
                generatedImageUrl: result.imageUrl || previewUrl,
                didValidationStatus: undefined,
                didValidationMessage: undefined,
              });
              setStatusMessage(tx('avatarGenerated'));
              if (dataUrl && result.imageUrl && !result.blob) {
                const blob = await dataUrlToBlob(dataUrl);
                await blob.arrayBuffer();
              }
            }
          }

          if (index === MORPH_STEP_COUNT - 1 && keys.did && (loadDraft().generatedImageUrl || loadDraft().generatedDataUrl)) {
            setStatusMessage(tx('checkingDid'));
            const currentDraft = loadDraft();
            const didResult = await validateDidAvatarForGeneratedImage({
              didKey: keys.did,
              imageProvider: settings.imageProvider,
              generatedImageUrl: currentDraft.generatedImageUrl,
              generatedImageDataUrl: currentDraft.generatedDataUrl,
            });
            if (cancelled) return;
            if (!didResult.ok) {
              saveDraft({
                step: 'PERSONA',
                didValidationStatus: 'failed',
                didValidationMessage: didResult.message,
                avatarId: undefined,
                didStreamId: undefined,
                avatarSourceUrl: undefined,
              });
              setStatusMessage(didResult.message);
              setActiveMorphStep(MORPH_STEP_COUNT);
              setWorking(false);
              return;
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
        if (!cancelled) {
          setActiveMorphStep(MORPH_STEP_COUNT);
          setStatusMessage(tx('characterReady'));
          setWorking(false);
        }
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
  }, [retryNonce]);

  function retryMorphing() {
    setRetryNonce((value) => value + 1);
  }

  const visibleError = configIssue ? morphingConfigMessage(configIssue, t) : error;
  const morphSteps = [
    { label: t('removeGuideLayer'), Icon: Trash2 },
    { label: t('analyzeColors'), Icon: Palette },
    { label: t('generateCharacter'), Icon: Sparkles },
    { label: t('validateFace'), Icon: Smile },
  ];
  const readyCardClass = visibleError ? 'error-card' : working ? 'working-card' : '';
  const readyTitle = visibleError ? t('morphingNeedsAttention') : working ? t('morphingProgress') : t('characterReady');
  const readyCopy = visibleError ? t('retryCopy') : statusMessage;
  const shownAccentColors = accentColors.length ? accentColors : FALLBACK_ACCENT_COLORS;
  const resultPreview = generatedDataUrl ? (
    <img className="morph-image" src={generatedDataUrl} alt={t('yourNewCharacter')} />
  ) : visibleError ? (
    <div className="result-placeholder result-error" role="status" aria-live="polite">
      <span className="result-mark">!</span>
      <b>{t('magicFailedShort')}</b>
      <small>{visibleError}</small>
    </div>
  ) : (
    <div className="result-placeholder result-loading" role="status" aria-live="polite">
      <span className="morph-loader" aria-hidden="true">
        <span className="morph-loader-frame">
          <span className="morph-loader-scan" />
          <ImageIcon size={34} strokeWidth={2.2} />
        </span>
      </span>
      <b>{statusMessage}</b>
    </div>
  );

  return (
    <>
      <section className="morph-stage">
        <article className="morph-card">{originalDataUrl ? <img className="morph-image" src={originalDataUrl} alt={t('yourDrawing')} /> : <DoodleDrawing />}<b>{t('yourDrawing')}</b></article>
        <div className="big-arrow" aria-hidden="true">→</div>
        <article className="morph-card result-card">{resultPreview}<b>{t('yourNewCharacter')}</b></article>
      </section>

      <section className="morph-status-board" aria-label={t('morphingProgress')}>
        <article className="morph-progress-card card">
          <h3>{visibleError ? t('morphingNeedsAttention') : working ? t('morphingProgress') : t('morphingComplete')}</h3>
          <div className="morph-step-list">
            {morphSteps.map(({ label, Icon }, index) => {
              const state = getMorphStepState(index, activeMorphStep, Boolean(visibleError), working, Boolean(generatedDataUrl));
              return (
                <div className={`morph-step-item ${state}`} key={label}>
                  <span className="morph-step-icon"><Icon size={17} /></span>
                  <span className="morph-step-copy"><b>{label}</b><small>{stepStateLabel(state, t)}</small></span>
                  <CircleCheck className="morph-step-check" size={20} />
                </div>
              );
            })}
          </div>
        </article>

        <div className="morph-side-panel">
          <article className="accent-card card">
            <h3>{t('extractedColors')}</h3>
            <div className="accent-swatches" aria-hidden="true">
              {shownAccentColors.map((color, index) => (
                <span className="accent-swatch" style={{ background: color }} key={`${color}-${index}`} />
              ))}
            </div>
          </article>

          <article className={`ready-card card morph-ready-card ${readyCardClass}`}>
            <span className={`check-big ${working && !visibleError ? 'loading-check' : ''}`}>{visibleError ? '!' : working ? null : <Check size={44} strokeWidth={3.4} />}</span>
            <div>
              <h3>{readyTitle}</h3>
              <b>{visibleError ? visibleError : readyCopy}</b>
              <p>{visibleError ? readyCopy : t('readyFinalCopy')}</p>
            </div>
            <div className="ready-actions">
              {visibleError ? <button className="primary-button" type="button" onClick={retryMorphing}><RefreshCw size={18} /> {t('retryMagic')}</button> : null}
              {visibleError ? <Link className="outline-button" href="/settings">{t('openSettings')}</Link> : null}
              <Link className="ghost-button" href="/create?draw=1">← {t('backToDrawing')}</Link>
              {!visibleError ? <Link className={`primary-button ${working ? 'disabled' : ''}`} href={working ? '/create/morph' : '/create/persona'}>{t('continueFinal')} →</Link> : null}
            </div>
          </article>
        </div>

        <div className="info-bar morph-info-bar"><Info size={20} /> <span>{t('validationInfo')}</span></div>
      </section>

    </>
  );
}

function getMorphStepState(index: number, activeStep: number, hasError: boolean, working: boolean, hasResult: boolean) {
  if (hasError) {
    if (index < activeStep) return 'completed';
    if (index === activeStep) return 'needs-retry';
    return 'waiting';
  }
  if (!working && hasResult) return 'completed';
  if (index < activeStep) return 'completed';
  if (index === activeStep) return 'working';
  return 'waiting';
}

function stepStateLabel(state: string, t: ReturnType<typeof useLanguage>['t']) {
  if (state === 'completed') return t('completed');
  if (state === 'needs-retry') return t('needsRetry');
  if (state === 'working') return t('working');
  return t('waiting');
}

function morphingConfigMessage(issue: ConfigIssue, t: ReturnType<typeof useLanguage>['t']) {
  if (issue === 'didKey') return t('didKeyMissing');
  return t('imageConfigMissing');
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

