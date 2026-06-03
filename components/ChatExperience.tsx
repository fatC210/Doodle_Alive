'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, Moon, Sun, Volume2 } from 'lucide-react';
import { refreshDidAgentClientKey } from '@/lib/did-agent-client';
import { getDidAgentEmbedConfig } from '@/lib/did-agent-embed';
import { getLocalizedPersonaName, getLocalizedStyleName } from '@/lib/display-names';
import { useLanguage } from '@/lib/i18n';
import { loadDidApiKey } from '@/lib/secrets';
import { getCharacter, getMessages, saveCharacter, saveMessage } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import type { ChatMessage, DoodleCharacter } from '@/lib/types';
import { CharacterAvatar } from './Illustrations';

export function ChatExperience({ characterId }: { characterId: string }) {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [character, setCharacter] = useState<DoodleCharacter | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoaded(false);
      const stored = await getCharacter(characterId);
      const refreshedCharacter = stored ? await refreshStoredDidClientKey(stored) : undefined;
      setCharacter(refreshedCharacter ?? null);
      const history = await getMessages(characterId);
      const repairedHistory = refreshedCharacter ? await repairCorruptedWelcomeMessages(history, refreshedCharacter, language) : history;
      setMessages(repairedHistory);
      setLoaded(true);
    }
    void load();
  }, [characterId, language]);

  const display = useMemo(() => character, [character]);
  const displayStyleName = display ? getLocalizedStyleName(display, language) : '';
  const displayPersonaName = display ? getLocalizedPersonaName(display, language) : '';
  const chatTheme = useMemo(() => display ? getCharacterChatTheme(display) : undefined, [display]);
  const chatThemeClass = display ? `theme-${normalizeThemeName(display.tone || display.styleId)}` : '';
  const didAgentConfig = getDidAgentEmbedConfig({ agentId: display?.didAgentId, clientKey: display?.didClientKey });

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
          {didAgentConfig ? <DidAgentEmbed agentId={didAgentConfig.agentId} clientKey={didAgentConfig.clientKey} /> : <MissingDidAgentConfig />}
          <header className="chat-main-header">
            <div className="chat-title-block">
              {display.generatedDataUrl ? <img className="stored-avatar small" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="sm" />}
              <span><b>{display.name}</b><span className="tag-row"><span className="tag">{displayStyleName}</span><span className="tag green">{displayPersonaName}</span></span></span>
            </div>
            <div className="chat-header-actions">
              <span className={`voice-status-pill ${didAgentConfig ? 'voice-live' : 'voice-error'}`} aria-live="polite">
                <Volume2 size={16} /> {didAgentConfig ? t('didAgentVoiceReady') : t('didAgentNotConfigured')}
              </span>
              <button className="chat-menu-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            </div>
          </header>
          <div className="chat-thread"><MessageList messages={messages} character={display} /></div>
          <div className="input-area did-agent-input-area">
            <p className="subtitle">{t('didAgentWidgetCopy')}</p>
          </div>
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

function isCorruptedWelcomeMessage(content: string, characterName: string) {
  const trimmed = content.trim();
  if (!trimmed.includes(characterName)) return false;
  const questionMarks = trimmed.match(/\?/g)?.length ?? 0;
  return questionMarks >= 8 && questionMarks / trimmed.length > 0.35;
}

async function repairCorruptedWelcomeMessages(messages: ChatMessage[], character: DoodleCharacter, language: string) {
  const repaired = messages.map((message) => {
    if (message.role !== 'character' || !isCorruptedWelcomeMessage(message.content, character.name)) return message;
    return {
      ...message,
      content: getWelcomeMessages(character.name, language)[0],
    };
  });

  await Promise.all(repaired
    .filter((message, index) => message !== messages[index])
    .map((message) => saveMessage(message)));

  return repaired;
}

type DidAgentsWindow = Window & {
  DID_AGENTS_API?: {
    functions?: {
      registerClientTool?: unknown;
    };
  };
};

const DID_AGENT_POLL_INTERVAL_MS = 100;
const DID_AGENT_POLL_TIMEOUT_MS = 5000;

function DidAgentEmbed({ agentId, clientKey }: { agentId: string; clientKey: string }) {
  const config = getDidAgentEmbedConfig({ agentId, clientKey });
  if (!config) return null;

  async function handleLoad() {
    const deadline = Date.now() + DID_AGENT_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if ((window as DidAgentsWindow).DID_AGENTS_API?.functions?.registerClientTool) return;
      await new Promise((resolve) => window.setTimeout(resolve, DID_AGENT_POLL_INTERVAL_MS));
    }
    console.warn('[D-ID Agent] DID_AGENTS_API was not available after 5s.');
  }

  return (
    <Script
      src={config.src}
      strategy="afterInteractive"
      type="module"
      crossOrigin="anonymous"
      data-name="did-agent"
      data-mode="fabio"
      data-position="right"
      data-orientation="horizontal"
      data-client-key={config.clientKey}
      data-agent-id={config.agentId}
      onLoad={() => { void handleLoad(); }}
      onError={(error) => console.error('[D-ID Agent] embed script failed to load', error)}
    />
  );
}

function MessageList({ messages, character }: { messages: ChatMessage[]; character: DoodleCharacter }) {
  const { t } = useLanguage();
  return (
    <>
      {messages.map((message) => {
        const isUser = message.role === 'user';
        const label = isUser ? t('you') : message.role === 'system' ? t('system') : character.name;
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
        <div key={message.id} className={`message ${isUser ? 'you' : ''} ${message.role === 'system' ? 'system' : ''}`}>
          {message.role === 'character' ? (character.generatedDataUrl ? <img className="stored-avatar small" src={character.generatedDataUrl} alt={character.name} /> : <CharacterAvatar tone={character.tone || 'mint'} size="sm" />) : null}
          <div className="bubble"><div className="message-meta"><b>{label}</b><span>{time}</span></div><p>{message.content}</p>{message.imageUrl ? <img className="chat-image" src={message.imageUrl} alt="" /> : null}</div>
        </div>
        );
      })}
    </>
  );
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

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(132, 86, 255, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

