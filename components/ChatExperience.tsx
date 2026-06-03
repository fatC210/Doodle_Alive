'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ChevronLeft, Moon, PhoneOff, Sun, Volume2 } from 'lucide-react';
import { refreshDidAgentClientKey } from '@/lib/did-agent-client';
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

export function ChatExperience({ characterId }: { characterId: string }) {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [character, setCharacter] = useState<DoodleCharacter | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [voiceSession, setVoiceSession] = useState<{ characterId: string; state: VoiceState }>({ characterId, state: 'idle' });
  const [voiceIssue, setVoiceIssue] = useState<VoiceIssue>('none');

  useEffect(() => {
    async function load() {
      setLoaded(false);
      const stored = await getCharacter(characterId);
      const refreshedCharacter = stored ? await refreshStoredDidClientKey(stored) : undefined;
      setCharacter(refreshedCharacter ?? null);
      setLoaded(true);
    }
    void load();
  }, [characterId]);

  const display = useMemo(() => character, [character]);
  const displayStyleName = display ? getLocalizedStyleName(display, language) : '';
  const displayPersonaName = display ? getLocalizedPersonaName(display, language) : '';
  const chatTheme = useMemo(() => display ? getCharacterChatTheme(display) : undefined, [display]);
  const chatThemeClass = display ? `theme-${normalizeThemeName(display.tone || display.styleId)}` : '';
  const didAgentConfig = getDidAgentEmbedConfig({ agentId: display?.didAgentId, clientKey: display?.didClientKey });
  const voiceState = voiceSession.characterId === characterId ? voiceSession.state : 'idle';
  const voiceStatusClass = getVoiceStatusClass(Boolean(didAgentConfig), voiceState);
  const voiceStatusLabel = getVoiceStatusLabel(Boolean(didAgentConfig), voiceState, t);
  const didAgentTargetId = useMemo(() => `did-agent-container-${normalizeDomId(characterId)}`, [characterId]);
  const shouldShowDidAgent = Boolean(didAgentConfig) && (voiceState === 'loading' || voiceState === 'ready');
  const voiceGreetingText = display ? getWelcomeMessages(display.name, language)[0] : '';
  const updateVoiceState = (state: VoiceState) => setVoiceSession({ characterId, state });

  async function handleStartVoiceChat() {
    setVoiceIssue('none');
    const microphoneStatus = await requestMicrophonePermission();
    if (microphoneStatus !== 'granted') {
      setVoiceIssue(microphoneStatus === 'denied' ? 'mic-denied' : 'mic-unavailable');
      updateVoiceState('error');
      return;
    }
    updateVoiceState('loading');
  }

  async function handleEndVoiceChat() {
    setVoiceIssue('none');
    try {
      await stopDidAgentSession();
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
          {shouldShowDidAgent && didAgentConfig ? (
            <DidAgentEmbed
              agentId={didAgentConfig.agentId}
              clientKey={didAgentConfig.clientKey}
              targetId={didAgentTargetId}
              greetingText={voiceGreetingText}
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
              {shouldShowDidAgent ? (
                <button className="chat-action-button chat-end-button" type="button" onClick={() => { void handleEndVoiceChat(); }} aria-label={t('endChat')}>
                  <PhoneOff size={18} /> {t('endChat')}
                </button>
              ) : null}
              <button className="chat-menu-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            </div>
          </header>
          <div className="chat-thread">
            {shouldShowDidAgent ? (
              <div
                id={didAgentTargetId}
                className={`did-agent-embed-panel ${voiceState === 'loading' ? 'loading' : ''}`}
                aria-label={t('startVoiceChat')}
              />
            ) : null}
          </div>
          {!shouldShowDidAgent ? (
            <div className="input-area did-agent-input-area">
              {didAgentConfig ? (
                <DidAgentLauncher
                  voiceState={voiceState}
                  voiceIssue={voiceIssue}
                  onStart={handleStartVoiceChat}
                />
              ) : (
                <MissingDidAgentConfig />
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

async function refreshStoredDidClientKey(character: DoodleCharacter) {
  if (!character.didAgentId) return character;

  try {
    const apiKey = await loadDidApiKey();
    const { clientKey } = await refreshDidAgentClientKey({
      agentId: character.didAgentId,
      apiKey,
      allowedDomains: window.location.origin,
    });
    if (!clientKey || clientKey === character.didClientKey) return character;

    const updatedCharacter = { ...character, didClientKey: clientKey, updatedAt: new Date().toISOString() };
    await saveCharacter(updatedCharacter);
    return updatedCharacter;
  } catch (error) {
    console.warn('[D-ID Agent] failed to refresh client key', error);
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

function DidAgentLauncher({ voiceState, voiceIssue, onStart }: { voiceState: VoiceState; voiceIssue: VoiceIssue; onStart: () => void | Promise<void> }) {
  const { t } = useLanguage();

  if (voiceState === 'ready') {
    return <p className="subtitle did-agent-status-copy">{t('voiceChatActiveCopy')}</p>;
  }

  if (voiceState === 'loading') {
    return <p className="subtitle did-agent-status-copy">{t('voiceChatConnecting')}</p>;
  }

  return (
    <div className="did-agent-launcher">
      {voiceState === 'error' ? (
        <div className="inline-warning did-agent-warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{getVoiceIssueCopy(voiceIssue, t)}</span>
        </div>
      ) : (
        <p className="subtitle">{t('didAgentWidgetCopy')}</p>
      )}
      <button className="primary-button did-agent-start-button" type="button" onClick={onStart}>
        <Volume2 size={18} /> {t('startVoiceChat')}
      </button>
    </div>
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

function getWelcomeMessages(characterName: string, language: string) {
  return language === 'zh' ? [
    `你好，我是 ${characterName}！我已经准备好和你聊天啦。`,
    `你好！${characterName} 醒来了。想聊聊画画、冒险，还是有趣的故事？`,
    `欢迎回来！我是 ${characterName}，我可以听你说话、回应你，也会和你一起互动。`,
    `太好啦，你来了！我是 ${characterName}。我们一起开始一个好玩的故事吧。`,
  ] : [
    `Hi, I'm ${characterName}! I'm ready to chat with you.`,
    `Hello! ${characterName} is awake. Want to talk about drawings, adventures, or something fun?`,
    `Welcome back! I'm ${characterName}, and I can listen, talk, and react with you.`,
    `Yay, you're here! I'm ${characterName}. Let's start a fun story together.`,
  ];
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
      speak?: (options: { type: 'text' | 'audio'; input: string }) => Promise<unknown> | unknown;
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

function DidAgentEmbed({ agentId, clientKey, targetId, greetingText, onReady, onEnded, onUnavailable }: { agentId: string; clientKey: string; targetId: string; greetingText: string; onReady: () => void; onEnded: () => void; onUnavailable: () => void }) {
  const handledReadyRef = useRef(false);
  const handledConnectionRef = useRef(false);
  const spokenGreetingRef = useRef(false);
  const unsubscribeConnectionRef = useRef<(() => void) | undefined>(undefined);
  const unsubscribeErrorRef = useRef<(() => void) | undefined>(undefined);
  const connectionTimeoutRef = useRef<number | undefined>(undefined);
  const config = getDidAgentEmbedConfig({ agentId, clientKey });

  useEffect(() => {
    handledReadyRef.current = false;
    handledConnectionRef.current = false;
    spokenGreetingRef.current = false;
    return () => {
      unsubscribeConnectionRef.current?.();
      unsubscribeErrorRef.current?.();
      if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
      unsubscribeConnectionRef.current = undefined;
      unsubscribeErrorRef.current = undefined;
      connectionTimeoutRef.current = undefined;
    };
  }, [agentId, clientKey, targetId]);

  if (!config) return null;

  async function handleScriptReady() {
    if (handledReadyRef.current) return;
    handledReadyRef.current = true;
    const deadline = Date.now() + DID_AGENT_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const api = (window as DidAgentsWindow).DID_AGENTS_API;
      if (api) {
        const handleConnection = (event: { state?: string }) => {
          const connectionState = String(event.state || '').toLowerCase();
          if (['closed', 'completed'].includes(connectionState)) {
            onEnded();
            return;
          }

          if (connectionState !== 'connected') return;

          if (!handledConnectionRef.current) {
            handledConnectionRef.current = true;
            if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current);
            onReady();
          }

          if (!spokenGreetingRef.current && greetingText.trim() && api.functions?.speak) {
            spokenGreetingRef.current = true;
            void Promise.resolve(api.functions.speak({
              type: 'text',
              input: greetingText,
            })).catch((error) => {
              console.warn('[D-ID Agent] failed to speak welcome message', error);
            });
          }
        };

        const connectionUnsubscribe = api.events?.on?.('connection', handleConnection);
        if (typeof connectionUnsubscribe === 'function') unsubscribeConnectionRef.current = connectionUnsubscribe;
        const errorUnsubscribe = api.events?.on?.('error', () => {
          if (!handledConnectionRef.current) onUnavailable();
        });
        if (typeof errorUnsubscribe === 'function') unsubscribeErrorRef.current = errorUnsubscribe;
        api.configure?.({
          autoConnect: true,
          openMode: 'expanded',
          orientation: 'horizontal',
        });
        if (api.events?.on) {
          connectionTimeoutRef.current = window.setTimeout(() => {
            if (!handledConnectionRef.current) onUnavailable();
          }, DID_AGENT_CONNECTION_TIMEOUT_MS);
        } else {
          onReady();
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, DID_AGENT_POLL_INTERVAL_MS));
    }
    console.warn('[D-ID Agent] DID_AGENTS_API was not available after 5s.');
    onUnavailable();
  }

  return (
    <Script
      src={config.src}
      strategy="afterInteractive"
      type="module"
      crossOrigin="anonymous"
      data-name="did-agent"
      data-mode="full"
      data-target-id={targetId}
      data-orientation="horizontal"
      data-open-mode="expanded"
      data-auto-connect="true"
      data-client-key={config.clientKey}
      data-agent-id={config.agentId}
      onLoad={() => { void handleScriptReady(); }}
      onReady={() => { void handleScriptReady(); }}
      onError={(error) => {
        console.warn('[D-ID Agent] embed script failed to load', error);
        onUnavailable();
      }}
    />
  );
}

async function stopDidAgentSession() {
  const api = (window as DidAgentsWindow).DID_AGENTS_API;
  const functions = api?.functions;

  const actions = [
    () => functions?.interrupt?.(),
    () => functions?.toggleMicState?.(true),
    () => functions?.toggleSpeakerState?.(true),
    () => functions?.requestFullscreen?.(false),
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

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(132, 86, 255, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

