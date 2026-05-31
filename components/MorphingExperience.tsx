'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, LoaderCircle, RefreshCw } from 'lucide-react';
import { getMorphingConfigIssues, type ConfigIssue } from '@/lib/config-requirements';
import { useLanguage } from '@/lib/i18n';
import { generateCharacterImage } from '@/lib/image-gen';
import { loadCustomImageKey, loadSecretKeys } from '@/lib/secrets';
import { validateDidAvatarForGeneratedImage } from '@/lib/settings-validation';
import { dataUrlToBlob, loadDraft, loadSettings, saveDraft } from '@/lib/storage';
import { DoodleDrawing } from './Illustrations';

const MORPH_STEP_COUNT = 4;
const GENERATE_STEP_INDEX = 2;

export function MorphingExperience() {
  const { t } = useLanguage();
  const tRef = useRef(t);
  const [originalDataUrl, setOriginalDataUrl] = useState('');
  const [generatedDataUrl, setGeneratedDataUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState(t('preparingCharacter'));
  const [error, setError] = useState('');
  const [configIssue, setConfigIssue] = useState<ConfigIssue | ''>('');
  const [working, setWorking] = useState(true);
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
      setGeneratedDataUrl('');
      setStatusMessage(tx('preparingCharacter'));
      setError('');
      setConfigIssue('');
      setWorking(true);
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
              setStatusMessage(tx('characterReady'));
              setWorking(false);
              if (dataUrl && result.imageUrl && !result.blob) {
                const blob = await dataUrlToBlob(dataUrl);
                await blob.arrayBuffer();
              }
            }
          }

          if (index === MORPH_STEP_COUNT - 1 && keys.did && isPublicImageUrl(loadDraft().generatedImageUrl)) {
            setStatusMessage(tx('checkingDid'));
            const currentDraft = loadDraft();
            const didResult = await validateDidAvatarForGeneratedImage({
              didKey: keys.did,
              imageProvider: settings.imageProvider,
              generatedImageUrl: currentDraft.generatedImageUrl,
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
  }, [retryNonce]);

  function retryMorphing() {
    setRetryNonce((value) => value + 1);
  }

  const visibleError = configIssue ? morphingConfigMessage(configIssue, t) : error;
  const resultPreview = generatedDataUrl ? (
    <img className="morph-image breathing" src={generatedDataUrl} alt={t('yourNewCharacter')} />
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
        <span className="morph-loader-status">
          <LoaderCircle size={18} />
          <span className="morph-loader-progress">
            <span />
            <span />
            <span />
            <span />
          </span>
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

      <div className="morph-actions">
        {visibleError ? <button className="primary-button" type="button" onClick={retryMorphing}><RefreshCw size={18} /> {t('retryMagic')}</button> : null}
        {visibleError ? <Link className="outline-button" href="/settings">{t('openSettings')}</Link> : null}
        <Link className="ghost-button" href="/create">← {t('backToDrawing')}</Link>
        {!visibleError ? <Link className={`primary-button ${working ? 'disabled' : ''}`} href={working ? '/create/morph' : '/create/persona'}>{t('continueFinal')} →</Link> : null}
      </div>
    </>
  );
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

function isPublicImageUrl(value: string | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}
