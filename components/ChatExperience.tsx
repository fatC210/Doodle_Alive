'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ChevronLeft, Moon, PhoneOff, Sun, Volume2 } from 'lucide-react';
import { provisionDidAgent, refreshDidAgentClientKey } from '@/lib/did-agent-client';
import { getDidAgentEmbedConfig } from '@/lib/did-agent-embed';
import { getLocalizedPersonaName, getLocalizedStyleName } from '@/lib/display-names';
import { useLanguage } from '@/lib/i18n';
import { loadDidApiKey } from '@/lib/secrets';
import { getCharacter, saveCharacter } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import type { DoodleCharacter } from '@/lib/types';
import { CharacterAvatar } from './Illustrations';

type VoiceState = 'idle' | 'loading' | 'ready' | 'error';
type VoiceIssue = 'none' | 'mic-denied' | 'mic-unavailable' | 'load-failed';

const didClientKeyRefreshes = new Map<string, Promise<DoodleCharacter>>();
const didAgentPosterRepairs = new Map<string, Promise<DoodleCharacter>>();

export function ChatExperience({ characterId }: { characterId: string }) {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [character, setCharacter] = useState<DoodleCharacter | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [voiceSession, setVoiceSession] = useState<{ characterId: string; state: VoiceState }>({ characterId, state: 'idle' });
  const [voiceIssue, setVoiceIssue] = useState<VoiceIssue>('none');
  const startingVoiceChatRef = useRef(false);

  useEffect(() => {
    async function load() {
      setLoaded(false);
      const stored = await getCharacter(characterId);
      const refreshedCharacter = stored ? await refreshStoredDidAgentConfig(stored, language) : undefined;
      setCharacter(refreshedCharacter ?? null);
      setLoaded(true);
    }
    void load();
  }, [characterId, language]);

  const display = useMemo(() => character, [character]);
  const displayStyleName = display ? getLocalizedStyleName(display, language) : '';
  const displayPersonaName = display ? getLocalizedPersonaName(display, language) : '';
  const chatTheme = useMemo(() => display ? getCharacterChatTheme(display) : undefined, [display]);
  const chatThemeClass = display ? `theme-${normalizeThemeName(display.tone || display.styleId)}` : '';
  const didAgentConfig = hasBrowserLoadableDidAgentImage(display)
    ? getDidAgentEmbedConfig({ agentId: display?.didAgentId, clientKey: display?.didClientKey })
    : null;
  const voiceState = voiceSession.characterId === characterId ? voiceSession.state : 'idle';
  const voiceStatusClass = getVoiceStatusClass(Boolean(didAgentConfig), voiceState);
  const voiceStatusLabel = getVoiceStatusLabel(Boolean(didAgentConfig), voiceState, t);
  const didAgentTargetId = useMemo(() => `did-agent-container-${normalizeDomId(characterId)}`, [characterId]);
  const isDidAgentActive = Boolean(didAgentConfig) && (voiceState === 'loading' || voiceState === 'ready');
  const updateVoiceState = (state: VoiceState) => setVoiceSession({ characterId, state });

  useEffect(() => {
    return () => {
      void resetDidAgentRuntime();
    };
  }, [characterId]);

  async function handleStartVoiceChat() {
    if (startingVoiceChatRef.current || voiceState === 'loading' || voiceState === 'ready') return;

    startingVoiceChatRef.current = true;
    try {
      setVoiceIssue('none');
      await resetDidAgentRuntime();
      const microphoneStatus = await requestMicrophonePermission();
      if (microphoneStatus !== 'granted') {
        setVoiceIssue(microphoneStatus === 'denied' ? 'mic-denied' : 'mic-unavailable');
        updateVoiceState('error');
        return;
      }
      updateVoiceState('loading');
    } finally {
      startingVoiceChatRef.current = false;
    }
  }

  async function handleEndVoiceChat() {
    setVoiceIssue('none');
    try {
      await resetDidAgentRuntime();
    } finally {
      updateVoiceState('idle');
    }
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="chat-topline"><Link className="ghost-button" href="/"><ChevronLeft size={18} /> {t('navHome')}</Link></div>
        <section className="ready-card card">
          <span className="check-big">...</span>
          <span><h2>{t('loadingCharacter')}</h2><p className="subtitle">{t('restoringCharacter')}</p></span>
        </section>
      </div>
    );
  }

  if (!display) {
    return (
      <div className="page-shell">
        <div className="chat-topline"><Link className="ghost-button" href="/"><ChevronLeft size={18} /> {t('navHome')}</Link></div>
        <section className="ready-card card error-card">
          <span className="check-big">!</span>
          <span><h2>{t('characterNotFound')}</h2><p className="subtitle">{t('characterNotFoundCopy')}</p></span>
          <Link className="primary-button" href="/create?new=1">{t('newCharacter')}</Link>
        </section>
      </div>
    );
  }

  return (
    <div className={`page-shell chat-page-shell ${chatThemeClass}`} style={chatTheme}>
      <section className="text-chat-layout">
        <aside className="character-side">
          <Link className="chat-back-button" href="/"><ChevronLeft size={20} /> {t('navHome')}</Link>
          <div className="character-portrait">
            {display.generatedDataUrl ? <img className="portrait-image" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="xl" />}
          </div>
          <div className="ready-box"><span className="dot" /><span><b>{display.name} {t('readyToChat')}</b><small>{t('didAgentReady')}</small></span></div>
        </aside>
        <div className="text-chat">
          {didAgentConfig && isDidAgentActive ? (
            <DidAgentEmbed
              agentId={didAgentConfig.agentId}
              clientKey={didAgentConfig.clientKey}
              targetId={didAgentTargetId}
              active={isDidAgentActive}
              onReady={() => updateVoiceState('ready')}
              onEnded={() => updateVoiceState('idle')}
              onUnavailable={() => {
                setVoiceIssue('load-failed');
                updateVoiceState('error');
              }}
            />
          ) : null}
          <header className="chat-main-header">
            <div className="chat-title-block">
              {display.generatedDataUrl ? <img className="stored-avatar small" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="sm" />}
              <span><b>{display.name}</b><span className="tag-row"><span className="tag">{displayStyleName}</span><span className="tag green">{displayPersonaName}</span></span></span>
            </div>
            <div className="chat-header-actions">
              <span className={`voice-status-pill ${voiceStatusClass}`} aria-live="polite">
                <Volume2 size={16} /> {voiceStatusLabel}
              </span>
              {isDidAgentActive ? (
                <button className="chat-action-button chat-end-button" type="button" onClick={() => { void handleEndVoiceChat(); }} aria-label={t('endChat')}>
                  <PhoneOff size={18} /> {t('endChat')}
                </button>
              ) : null}
              <button className="chat-menu-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            </div>
          </header>
          <div className="chat-thread">
            {didAgentConfig && isDidAgentActive ? (
              <div
                id={didAgentTargetId}
                className={`did-agent-embed-panel ${voiceState === 'loading' ? 'loading' : ''} ${isDidAgentActive ? '' : 'preloading'}`}
                aria-label={t('startVoiceChat')}
                aria-hidden={!isDidAgentActive}
              />
            ) : null}
            {!isDidAgentActive ? (
              <VoiceChatEmptyState
                characterName={display.name}
                hasVoiceConfig={Boolean(didAgentConfig)}
                voiceState={voiceState}
                voiceIssue={voiceIssue}
                onStart={handleStartVoiceChat}
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

async function refreshStoredDidAgentConfig(character: DoodleCharacter, language: string) {
  const withClientKey = await refreshStoredDidClientKey(character, language);
  return await repairStoredDidAgentPoster(withClientKey, language);
}

async function refreshStoredDidClientKey(character: DoodleCharacter, language: string) {
  if (!character.didAgentId) return character;
  const currentOrigin = window.location.origin;
  if (character.didClientKey && character.didClientKeyOrigin === currentOrigin) return character;

  const refreshKey = [character.id, character.didAgentId, currentOrigin, language].join(':');
  const pendingRefresh = didClientKeyRefreshes.get(refreshKey);
  if (pendingRefresh) return pendingRefresh;

  const refreshPromise = refreshMissingDidClientKey(character, character.didAgentId, language);
  didClientKeyRefreshes.set(refreshKey, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    didClientKeyRefreshes.delete(refreshKey);
  }
}

async function refreshMissingDidClientKey(character: DoodleCharacter, agentId: string, language: string) {
  try {
    const currentOrigin = window.location.origin;
    const apiKey = await loadDidApiKey();
    const { clientKey } = await refreshDidAgentClientKey({
      agentId,
      apiKey,
      allowedDomains: currentOrigin,
      characterName: character.name,
      personaPrompt: character.personaPrompt,
      language,
    });
    if (!clientKey) return character;

    const updatedCharacter = {
      ...character,
      didClientKey: clientKey,
      didClientKeyOrigin: currentOrigin,
      updatedAt: new Date().toISOString(),
    };
    await saveCharacter(updatedCharacter);
    return updatedCharacter;
  } catch (error) {
    console.warn('[D-ID Agent] failed to refresh client key', error);
    return character;
  }
}

async function repairStoredDidAgentPoster(character: DoodleCharacter, language: string) {
  if (!needsDidAgentPosterRepair(character)) return character;

  const repairKey = [character.id, character.didAgentId, window.location.origin, language, 'poster'].join(':');
  const pendingRepair = didAgentPosterRepairs.get(repairKey);
  if (pendingRepair) return pendingRepair;

  const repairPromise = patchDidAgentPoster(character, language).finally(() => {
    didAgentPosterRepairs.delete(repairKey);
  });
  didAgentPosterRepairs.set(repairKey, repairPromise);
  return repairPromise;
}

function needsDidAgentPosterRepair(character: DoodleCharacter) {
  if (!character.didAgentId) return false;
  if (!usesInternalDidImageUrl(character)) return false;
  return Boolean(character.generatedDataUrl?.startsWith('data:image/') || isHttpUrl(character.generatedImageUrl));
}

function hasBrowserLoadableDidAgentImage(character: DoodleCharacter | null) {
  if (!character?.didAgentId || !character.didClientKey) return false;
  return !usesInternalDidImageUrl(character);
}

function usesInternalDidImageUrl(character: DoodleCharacter) {
  return Boolean(character.didSourceUrl?.startsWith('s3://') || character.didPosterUrl?.startsWith('s3://'));
}

async function patchDidAgentPoster(character: DoodleCharacter, language: string) {
  try {
    const apiKey = await loadDidApiKey();
    const didAgent = await provisionDidAgent({
      characterId: character.id,
      characterName: character.name,
      personaPrompt: character.personaPrompt,
      imageDataUrl: character.generatedDataUrl?.startsWith('data:image/') ? character.generatedDataUrl : undefined,
      imageUrl: isHttpUrl(character.generatedImageUrl) ? character.generatedImageUrl : undefined,
      agentId: character.didAgentId,
      apiKey,
      allowedDomains: window.location.origin,
      language,
    });

    const updatedCharacter = {
      ...character,
      didAgentId: didAgent.agentId,
      didClientKey: didAgent.clientKey,
      didClientKeyOrigin: window.location.origin,
      didSourceUrl: didAgent.sourceUrl,
      didPosterUrl: didAgent.posterUrl,
      didStatus: didAgent.status,
      updatedAt: new Date().toISOString(),
    };
    await saveCharacter(updatedCharacter);
    return updatedCharacter;
  } catch (error) {
    console.warn('[D-ID Agent] failed to repair presenter poster', error);
    return character;
  }
}

function MissingDidAgentConfig() {
  const { t } = useLanguage();

  return (
    <div className="inline-warning">
      {t('didAgentEmbedMissing')}
    </div>
  );
}

function VoiceChatEmptyState({ characterName, hasVoiceConfig, voiceState, voiceIssue, onStart }: { characterName: string; hasVoiceConfig: boolean; voiceState: VoiceState; voiceIssue: VoiceIssue; onStart: () => void | Promise<void> }) {
  const { t } = useLanguage();

  return (
    <section className="voice-empty-state" aria-label={t('startVoiceChat')}>
      {hasVoiceConfig ? (
        <DidAgentLauncher characterName={characterName} voiceState={voiceState} voiceIssue={voiceIssue} onStart={onStart} />
      ) : (
        <MissingDidAgentConfig />
      )}
    </section>
  );
}

function DidAgentLauncher({ characterName, voiceState, voiceIssue, onStart }: { characterName: string; voiceState: VoiceState; voiceIssue: VoiceIssue; onStart: () => void | Promise<void> }) {
  const { t } = useLanguage();

  if (voiceState === 'ready') {
    return <p className="subtitle did-agent-status-copy">{t('voiceChatActiveCopy')}</p>;
  }

  if (voiceState === 'loading') {
    return <p className="subtitle did-agent-status-copy">{t('voiceChatConnecting')}</p>;
  }

  return (
    <div className="did-agent-launcher">
      <div className="voice-welcome-copy">
        <p className="voice-welcome-eyebrow">{t('voiceWelcomeEyebrow')}</p>
        <h2><span>{characterName}</span><span className="voice-welcome-wave" aria-hidden="true">👋</span></h2>
        <p className="subtitle">{t('didAgentWidgetCopy')}</p>
      </div>
      <VoiceWelcomeArt />
      {voiceState === 'error' ? (
        <div className="inline-warning did-agent-warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{getVoiceIssueCopy(voiceIssue, t)}</span>
        </div>
      ) : null}
      <div className="voice-action-row">
        <div className="voice-waveform" aria-hidden="true">
          {Array.from({ length: 42 }).map((_, index) => <span key={index} />)}
        </div>
        <button className="primary-button did-agent-start-button" type="button" onClick={onStart}>
          <Volume2 size={18} /> {t('startVoiceChat')}
        </button>
      </div>
    </div>
  );
}

function VoiceWelcomeArt() {
  return (
    <div className="voice-welcome-art" aria-hidden="true" />
  );
}

function getVoiceIssueCopy(voiceIssue: VoiceIssue, t: ReturnType<typeof useLanguage>['t']) {
  if (voiceIssue === 'mic-denied') return t('micDenied');
  if (voiceIssue === 'mic-unavailable') return t('micUnavailableNow');
  return t('loadVoiceChatFailed');
}

function getVoiceStatusClass(hasConfig: boolean, voiceState: VoiceState) {
  if (!hasConfig) return 'voice-error';
  if (voiceState === 'loading') return 'voice-connecting';
  if (voiceState === 'ready') return 'voice-live';
  if (voiceState === 'error') return 'voice-error';
  return 'voice-text';
}

function getVoiceStatusLabel(hasConfig: boolean, voiceState: VoiceState, t: ReturnType<typeof useLanguage>['t']) {
  if (!hasConfig) return t('didAgentNotConfigured');
  if (voiceState === 'loading') return t('voiceChatConnecting');
  if (voiceState === 'ready') return t('didAgentVoiceReady');
  if (voiceState === 'error') return t('voiceChatUnavailable');
  return t('voiceReady');
}

async function requestMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable' as const;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted' as const;
  } catch (error) {
    if (error instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name)) {
      return 'denied' as const;
    }
    console.warn('[D-ID Agent] microphone permission check failed', error);
    return 'unavailable' as const;
  }
}

type DidAgentsWindow = Window & {
  DID_AGENTS_API?: {
    configure?: (options: Record<string, string | boolean | number>) => void;
    events?: {
      on?: (eventName: string, callback: (event: { state?: string; error?: unknown }) => void) => (() => void) | void;
    };
    functions?: {
      registerClientTool?: unknown;
      toggleMicState?: (state?: boolean) => Promise<unknown> | unknown;
      toggleSpeakerState?: (state?: boolean) => Promise<unknown> | unknown;
      interrupt?: () => Promise<unknown> | unknown;
      requestFullscreen?: (state?: boolean) => Promise<unknown> | unknown;
    };
  };
};

const DID_AGENT_POLL_INTERVAL_MS = 100;
const DID_AGENT_POLL_TIMEOUT_MS = 5000;
const DID_AGENT_CONNECTION_TIMEOUT_MS = 15000;

async function waitForDidAgentApi() {
  const deadline = Date.now() + DID_AGENT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const api = (window as DidAgentsWindow).DID_AGENTS_API;
    if (api) return api;
    await new Promise((resolve) => window.setTimeout(resolve, DID_AGENT_POLL_INTERVAL_MS));
  }
  return undefined;
}

function DidAgentEmbed({ agentId, clientKey, targetId, active, onReady, onEnded, onUnavailable }: { agentId: string; clientKey: string; targetId: string; active: boolean; onReady: () => void; onEnded: () => void; onUnavailable: () => void }) {
  const handledReadyRef = useRef(false);
  const handledConnectionRef = useRef(false);
  const activeRef = useRef(active);
  const syncRunRef = useRef(0);
  const scriptRef = useRef<HTMLScriptElement | undefined>(undefined);
  const unsubscribeConnectionRef = useRef<(() => void) | undefined>(undefined);
  const unsubscribeErrorRef = useRef<(() => void) | undefined>(undefined);
  const connectionTimeoutRef = useRef<number | undefined>(undefined);
  const config = useMemo(() => getDidAgentEmbedConfig({ agentId, clientKey }), [agentId, clientKey]);
  const callbacksRef = useRef({ onReady, onEnded, onUnavailable });

  useEffect(() => {
    callbacksRef.current = { onReady, onEnded, onUnavailable };
  }, [onReady, onEnded, onUnavailable]);

  const syncDidAgentMode = useCallback(async (shouldConnect: boolean) => {
    const runId = syncRunRef.current + 1;
    syncRunRef.current = runId;
    const api = await waitForDidAgentApi();
    if (syncRunRef.current !== runId) return;

    if (!api) {
      console.warn('[D-ID Agent] DID_AGENTS_API was not available after 5s.');
      callbacksRef.current.onUnavailable();
      return;
    }

    unsubscribeConnectionRef.current?.();
    unsubscribeErrorRef.current?.();
    if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
    unsubscribeConnectionRef.current = undefined;
    unsubscribeErrorRef.current = undefined;
    connectionTimeoutRef.current = undefined;
    handledConnectionRef.current = false;

    if (!shouldConnect) {
      api.configure?.({ autoConnect: false, openMode: 'compact', orientation: 'horizontal' });
      return;
    }

    const handleConnection = (event: { state?: string }) => {
      const connectionState = String(event.state || '').toLowerCase();
      if (['closed', 'completed'].includes(connectionState)) {
        callbacksRef.current.onEnded();
        return;
      }

      if (connectionState !== 'connected') return;

      if (!handledConnectionRef.current) {
        handledConnectionRef.current = true;
        if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
        callbacksRef.current.onReady();
      }

    };

    const connectionUnsubscribe = api.events?.on?.('connection', handleConnection);
    if (typeof connectionUnsubscribe === 'function') unsubscribeConnectionRef.current = connectionUnsubscribe;
    const errorUnsubscribe = api.events?.on?.('error', () => {
      if (!handledConnectionRef.current) callbacksRef.current.onUnavailable();
    });
    if (typeof errorUnsubscribe === 'function') unsubscribeErrorRef.current = errorUnsubscribe;

    api.configure?.({
      autoConnect: true,
      openMode: 'expanded',
      orientation: 'horizontal',
    });

    if (api.events?.on) {
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (!handledConnectionRef.current) callbacksRef.current.onUnavailable();
      }, DID_AGENT_CONNECTION_TIMEOUT_MS);
    } else {
      callbacksRef.current.onReady();
    }
  }, []);

  const handleScriptReady = useCallback(async () => {
    if (handledReadyRef.current) return;
    handledReadyRef.current = true;
    await syncDidAgentMode(activeRef.current);
  }, [syncDidAgentMode]);

  useEffect(() => {
    handledReadyRef.current = false;
    handledConnectionRef.current = false;
    return () => {
      unsubscribeConnectionRef.current?.();
      unsubscribeErrorRef.current?.();
      if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
      syncRunRef.current += 1;
      unsubscribeConnectionRef.current = undefined;
      unsubscribeErrorRef.current = undefined;
      connectionTimeoutRef.current = undefined;
      void resetDidAgentRuntime(scriptRef.current);
      scriptRef.current = undefined;
    };
  }, [agentId, clientKey, targetId]);

  useEffect(() => {
    activeRef.current = active;
    if (handledReadyRef.current) void syncDidAgentMode(active);
  }, [active, syncDidAgentMode]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const script = document.createElement('script');
    script.type = 'module';
    script.crossOrigin = 'anonymous';
    script.dataset.name = 'did-agent';
    script.dataset.mode = 'full';
    script.dataset.targetId = targetId;
    script.dataset.orientation = 'horizontal';
    script.dataset.openMode = activeRef.current ? 'expanded' : 'compact';
    script.dataset.autoConnect = activeRef.current ? 'true' : 'false';
    script.dataset.clientKey = config.clientKey;
    script.dataset.agentId = config.agentId;
    script.src = `${config.src}${config.src.includes('?') ? '&' : '?'}session=${encodeURIComponent(`${targetId}-${Date.now()}`)}`;
    script.onload = () => {
      if (cancelled) {
        void resetDidAgentRuntime(script);
        return;
      }
      void handleScriptReady();
    };
    script.onerror = (error) => {
      if (cancelled) return;
      console.warn('[D-ID Agent] embed script failed to load', error);
      callbacksRef.current.onUnavailable();
    };

    void resetDidAgentRuntime().then(() => {
      if (cancelled) return;
      scriptRef.current = script;
      document.body.appendChild(script);
    });

    return () => {
      cancelled = true;
      if (script.parentElement) script.remove();
    };
  }, [config, handleScriptReady, targetId]);

  return null;
}

async function stopDidAgentSession() {
  const api = (window as DidAgentsWindow).DID_AGENTS_API;
  const functions = api?.functions;

  const actions = [
    () => functions?.interrupt?.(),
    () => functions?.toggleMicState?.(true),
    () => functions?.toggleSpeakerState?.(true),
    () => document.fullscreenElement ? document.exitFullscreen() : undefined,
    () => api?.configure?.({ autoConnect: false, openMode: 'compact' }),
  ];

  for (const action of actions) {
    try {
      await Promise.resolve(action());
    } catch (error) {
      console.warn('[D-ID Agent] failed while ending voice chat', error);
    }
  }
}

async function resetDidAgentRuntime(script?: HTMLScriptElement) {
  await stopDidAgentSession();
  script?.remove();
  document.querySelectorAll<HTMLScriptElement>('script[data-name="did-agent"]').forEach((didScript) => didScript.remove());
  delete (window as DidAgentsWindow).DID_AGENTS_API;
}

function getCharacterChatTheme(character: DoodleCharacter): CSSProperties {
  const palette = getTonePalette(character.tone || character.styleId);
  const accentColors = character.accentColors?.filter((color) => /^#[0-9a-f]{6}$/i.test(color)) ?? [];
  const primary = palette[0] || accentColors[0] || '#8456ff';
  const secondary = palette[1] || accentColors[1] || '#ff8abf';
  const soft = palette[2] || accentColors[2] || '#f6f0ff';

  return {
    '--chat-accent': primary,
    '--chat-accent-2': secondary,
    '--chat-soft': soft,
    '--chat-line': colorWithAlpha(primary, 0.24),
    '--chat-line-strong': colorWithAlpha(primary, 0.44),
    '--chat-glow': colorWithAlpha(primary, 0.2),
  } as CSSProperties;
}

function getTonePalette(tone: string) {
  const palettes: Record<string, [string, string, string]> = {
    academy: ['#2d5f9a', '#c98b4a', '#eef4ff'],
    studio: ['#222222', '#b8bec8', '#f4f5f7'],
    comic: ['#ff4d5a', '#ffd23f', '#fff4df'],
    watercolor: ['#73a7ff', '#ff9ed8', '#f1f7ff'],
    cyber: ['#00e5ff', '#ff4fd8', '#effbff'],
    fantasy: ['#9b6dff', '#ffca5f', '#f6efff'],
  };

  return palettes[normalizeThemeName(tone)] ?? ['#8456ff', '#ff8abf', '#f6f0ff'];
}

function normalizeThemeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}

function normalizeDomId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'agent';
}

function isHttpUrl(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(132, 86, 255, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

