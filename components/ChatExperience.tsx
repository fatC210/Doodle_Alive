'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Conversation, type Conversation as ElevenConversation } from '@elevenlabs/client';
import { ChevronLeft, Mic, MicOff, Moon, Send, Sun, Volume2 } from 'lucide-react';
import { getCustomChatConfigIssues } from '@/lib/config-requirements';
import { generateCharacterReply } from '@/lib/conversation';
import { DidStreamingAvatar, uploadDidImage } from '@/lib/did';
import { getLocalizedPersonaName, getLocalizedStyleName } from '@/lib/display-names';
import { getElevenConversationToken } from '@/lib/elevenlabs';
import { useLanguage } from '@/lib/i18n';
import { loadCustomLlmKey, loadSecretKeys } from '@/lib/secrets';
import { getCharacter, getMessages, loadSettings, saveCharacter, saveMessage } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import type { ChatMessage, DoodleCharacter, RealtimeConnectionState } from '@/lib/types';
import { CharacterAvatar } from './Illustrations';

export function ChatExperience({ characterId }: { characterId: string }) {
  const { language, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [character, setCharacter] = useState<DoodleCharacter | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [needsCustomChatConfig, setNeedsCustomChatConfig] = useState(false);
  const [needsElevenLabsConfig, setNeedsElevenLabsConfig] = useState(false);
  const [needsDidConfig, setNeedsDidConfig] = useState(false);
  const [didPreviewEnabled, setDidPreviewEnabled] = useState(false);
  const voiceSessionRef = useRef<ElevenConversation | null>(null);
  const didAvatarRef = useRef<DidStreamingAvatar | null>(null);
  const didVideoRef = useRef<HTMLVideoElement | null>(null);
  const savedAgentEventIdsRef = useRef<Set<number>>(new Set());
  const savedUserEventIdsRef = useRef<Set<number>>(new Set());
  const pendingTextMessagesRef = useRef<string[]>([]);
  const pendingAvatarSpeechRef = useRef<string[]>([]);
  const voiceConnectedRef = useRef(false);
  const welcomedCharacterRef = useRef('');
  const [connection, setConnection] = useState<RealtimeConnectionState>({
    live: 'connecting',
    stt: 'connecting',
    agent: 'connecting',
    avatar: 'ready',
    message: t('readyWhen'),
    reconnectAttempts: 0,
  });

  useEffect(() => {
    async function load() {
      setLoaded(false);
      setCharacter(null);
      savedAgentEventIdsRef.current.clear();
      savedUserEventIdsRef.current.clear();
      pendingTextMessagesRef.current = [];
      pendingAvatarSpeechRef.current = [];
      voiceConnectedRef.current = false;
      welcomedCharacterRef.current = '';
      setDidPreviewEnabled(false);
      const stored = await getCharacter(characterId);
      if (stored) setCharacter(stored);
      const history = await getMessages(characterId);
      const repairedHistory = stored ? await repairCorruptedWelcomeMessages(history, stored, language) : history;
      setMessages(repairedHistory);
      setLoaded(true);
    }
    load();
  }, [characterId, language]);

  useEffect(() => {
    return () => {
      const session = voiceSessionRef.current;
      const didAvatar = didAvatarRef.current;
      voiceSessionRef.current = null;
      didAvatarRef.current = null;
      void session?.endSession().catch(() => {});
      void didAvatar?.destroy().catch(() => {});
    };
  }, []);

  useEffect(() => {
    async function prepare() {
      const settings = loadSettings();
      const keys = await loadSecretKeys();
      const customLlmKey = await loadCustomLlmKey();
      const customChatIssues = getCustomChatConfigIssues(settings, customLlmKey);
      setNeedsCustomChatConfig(Boolean(customChatIssues.length));
      setNeedsElevenLabsConfig(!keys.elevenLabs);
      setNeedsDidConfig(!keys.did);
      setConnection({
        live: 'connecting',
        stt: 'connecting',
        agent: 'connecting',
        avatar: 'ready',
        message: t('readyWhen'),
        reconnectAttempts: 0,
      });
    }
    prepare();
  }, [t]);

  const display = useMemo(() => character, [character]);
  const displayStyleName = display ? getLocalizedStyleName(display, language) : '';
  const displayPersonaName = display ? getLocalizedPersonaName(display, language) : '';
  const canUseDidAvatar = display ? Boolean(getPublicDidAvatarSource(display) || display.generatedDataUrl || display.originalDataUrl) : false;
  const chatTheme = useMemo(() => display ? getCharacterChatTheme(display) : undefined, [display]);
  const chatThemeClass = display ? `theme-${normalizeThemeName(display.tone || display.styleId)}` : '';
  const isVoiceLive = connection.live === 'ready' && connection.stt === 'listening';
  const isVoiceConnecting = connection.live === 'connecting' || connection.stt === 'connecting' || connection.agent === 'connecting';
  const voiceModeClass = isVoiceLive ? 'voice-live' : isVoiceConnecting ? 'voice-connecting' : connection.live === 'error' ? 'voice-error' : 'voice-text';
  const voiceModeTitle = isVoiceLive ? t('voiceChatActive') : isVoiceConnecting ? t('voiceChatConnecting') : connection.live === 'error' ? t('voiceChatUnavailable') : t('textModeActive');
  const voiceModeDetail = isVoiceLive ? t('voiceChatActiveCopy') : connection.message;

  const flushPendingSpeechToBrowser = useCallback(() => {
    const pendingSpeech = pendingAvatarSpeechRef.current.splice(0);
    pendingSpeech.forEach((speech) => speakWithBrowserVoice(speech, language));
  }, [language]);

  const speakWithAvatar = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const avatar = didAvatarRef.current;
    if (avatar) {
      void avatar.speak(trimmed).catch(() => speakWithBrowserVoice(trimmed, language));
      return;
    }
    if (canUseDidAvatar && !needsDidConfig) {
      pendingAvatarSpeechRef.current.push(trimmed);
      window.setTimeout(() => {
        const pendingIndex = pendingAvatarSpeechRef.current.indexOf(trimmed);
        if (pendingIndex < 0 || didAvatarRef.current) return;
        pendingAvatarSpeechRef.current.splice(pendingIndex, 1);
        speakWithBrowserVoice(trimmed, language);
      }, 1200);
      return;
    }
    speakWithBrowserVoice(trimmed, language);
  }, [canUseDidAvatar, language, needsDidConfig]);

  const addConversationMessage = useCallback(async (role: ChatMessage['role'], content: string, eventId?: number) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (role === 'user' && typeof eventId === 'number') {
      if (savedUserEventIdsRef.current.has(eventId)) return;
      savedUserEventIdsRef.current.add(eventId);
    }

    if (role === 'character' && typeof eventId === 'number') {
      if (savedAgentEventIdsRef.current.has(eventId)) return;
      savedAgentEventIdsRef.current.add(eventId);
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      characterId,
      role,
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((items) => [...items, message]);
    await saveMessage(message);
  }, [characterId]);

  const addWelcomeMessage = useCallback(async (currentCharacter: DoodleCharacter, existingMessages: ChatMessage[]) => {
    if (existingMessages.length || welcomedCharacterRef.current === currentCharacter.id) return;
    welcomedCharacterRef.current = currentCharacter.id;
    const welcome = getRandomWelcomeMessage(currentCharacter.name, language);
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      characterId,
      role: 'character',
      content: welcome,
      timestamp: new Date().toISOString(),
    };
    setMessages((items) => items.length ? items : [...items, message]);
    await saveMessage(message);
    speakWithAvatar(welcome);
  }, [characterId, language, speakWithAvatar]);

  async function sendMessage(value = text) {
    if (!display) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    const session = voiceSessionRef.current;
    if (session?.isOpen()) {
      const userMessage: ChatMessage = { id: `msg-${Date.now()}`, characterId, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
      setMessages((items) => [...items, userMessage]);
      setText('');
      await saveMessage(userMessage);
      pendingTextMessagesRef.current.push(trimmed);
      session.sendUserMessage(trimmed);
      session.sendUserActivity();
      setConnection((current) => ({ ...current, agent: 'thinking', avatar: 'thinking', message: `${display.name} ${t('thinking')}` }));
      return;
    }

    const keys = await loadSecretKeys();
    if (!keys.elevenLabs) {
      const message = 'ElevenLabs API key is missing. Add it in Settings, then try again.';
      setNeedsElevenLabsConfig(true);
      setConnection((current) => ({ ...current, live: 'error', stt: 'error', agent: 'error', avatar: 'ready', message }));
      return;
    }

    const settings = { ...loadSettings(), customLlmKey: await loadCustomLlmKey() };
    if (getCustomChatConfigIssues(settings, settings.customLlmKey).length) {
      const message = t('customLlmConfigMissing');
      setNeedsCustomChatConfig(true);
      setConnection((current) => ({ ...current, agent: 'error', avatar: 'ready', message }));
      return;
    }
    setNeedsCustomChatConfig(false);
    const userMessage: ChatMessage = { id: `msg-${Date.now()}`, characterId, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setConnection((current) => ({ ...current, agent: 'thinking', avatar: 'thinking', message: `${display.name} ${t('thinking')}` }));
    setMessages((items) => [...items, userMessage]);
    setText('');
    await saveMessage(userMessage);
    try {
      const replyContent = await generateCharacterReply(trimmed, display, settings, { elevenLabs: keys.elevenLabs });
      const reply: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        characterId,
        role: 'character',
        content: replyContent,
        timestamp: new Date().toISOString(),
      };
      setConnection((current) => ({ ...current, agent: 'speaking', avatar: 'speaking', message: `${display.name} ${t('speaking')}` }));
      setMessages((items) => [...items, reply]);
      await saveMessage(reply);
      speakWithAvatar(replyContent);
      window.setTimeout(() => setConnection((current) => ({ ...current, agent: 'ready', avatar: 'ready', message: t('readyNextTurn') })), 900);
    } catch (error) {
      const systemMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        characterId,
        role: 'system',
        content: error instanceof Error ? error.message : t('chatFailed'),
        timestamp: new Date().toISOString(),
      };
      setConnection((current) => ({ ...current, agent: 'error', avatar: 'ready', message: systemMessage.content }));
      setMessages((items) => [...items, systemMessage]);
      await saveMessage(systemMessage);
    }
  }

  useEffect(() => {
    if (!loaded || !display) return;
    void addWelcomeMessage(display, messages);
  }, [addWelcomeMessage, display, loaded, messages]);

  useEffect(() => {
    if (!loaded || !display) return;
    let cancelled = false;
    let session: ElevenConversation | null = null;

    async function startAgentSession() {
      if (!display?.agentId) {
        const message = 'This character does not have an ElevenLabs agent yet. Create the character again after saving Settings.';
        setNeedsElevenLabsConfig(true);
        setConnection((current) => ({ ...current, live: 'error', stt: 'error', agent: 'error', avatar: 'ready', message }));
        return;
      }

      const settings = loadSettings();
      const keys = await loadSecretKeys();
      const customLlmKey = await loadCustomLlmKey();
      const customChatIssues = getCustomChatConfigIssues(settings, customLlmKey);
      setNeedsCustomChatConfig(Boolean(customChatIssues.length));
      setNeedsElevenLabsConfig(!keys.elevenLabs);
      setNeedsDidConfig(!keys.did);
      if (!keys.elevenLabs || customChatIssues.length) {
        setConnection((current) => ({ ...current, live: 'error', stt: 'error', agent: 'error', avatar: 'ready', message: !keys.elevenLabs ? 'ElevenLabs API key is missing. Add it in Settings, then try again.' : t('customLlmConfigMissing') }));
        return;
      }

      try {
        setConnection((current) => ({ ...current, live: 'connecting', stt: 'connecting', agent: 'connecting', avatar: 'ready', message: t('readyWhen') }));
        const conversationToken = await getElevenConversationToken(display.agentId, keys.elevenLabs);
        if (cancelled) return;
        session = await Conversation.startSession({
          conversationToken,
          connectionType: 'webrtc',
          useWakeLock: true,
          overrides: {
            agent: {
              language: language === 'zh' ? 'zh' : 'en',
            },
          },
          onConnect: () => {
            voiceConnectedRef.current = true;
            setConnection((current) => ({ ...current, live: 'ready', stt: 'listening', agent: 'ready', avatar: 'ready', message: t('listening') }));
          },
          onDisconnect: () => {
            if (cancelled) return;
            setConnection((current) => ({
              ...current,
              live: 'idle',
              stt: 'idle',
              agent: 'idle',
              avatar: current.avatar === 'speaking' ? 'speaking' : 'ready',
              message: voiceConnectedRef.current ? t('voiceDisconnected') : t('readyWhen'),
            }));
          },
          onStatusChange: ({ status }) => {
            if (status === 'connecting') setConnection((current) => ({ ...current, live: 'connecting', stt: 'connecting', agent: 'connecting', message: t('readyWhen') }));
          },
          onModeChange: ({ mode }) => {
            setConnection((current) => ({ ...current, stt: mode === 'listening' ? 'listening' : current.stt, agent: mode === 'speaking' ? 'speaking' : 'ready', avatar: mode === 'speaking' ? 'speaking' : 'ready', message: mode === 'speaking' ? `${display.name} ${t('speaking')}` : t('listening') }));
          },
          onMessage: (message) => {
            const role = message.role === 'user' ? 'user' : 'character';
            if (role === 'user') {
              const pendingIndex = pendingTextMessagesRef.current.findIndex((pending) => pending === message.message.trim());
              if (pendingIndex >= 0) {
                pendingTextMessagesRef.current.splice(pendingIndex, 1);
                if (typeof message.event_id === 'number') savedUserEventIdsRef.current.add(message.event_id);
                return;
              }
            }
            void addConversationMessage(role, message.message, message.event_id);
            if (role === 'character') speakWithAvatar(message.message);
          },
          onError: (message) => {
            setConnection((current) => ({ ...current, live: 'error', stt: 'error', agent: 'error', avatar: 'ready', message }));
          },
        });
        if (cancelled) {
          void session.endSession().catch(() => {});
          return;
        }
        voiceSessionRef.current = session;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('micDenied');
        setConnection((current) => ({ ...current, live: 'error', stt: 'error', agent: 'error', avatar: 'ready', message }));
      }
    }

    void startAgentSession();
    return () => {
      cancelled = true;
      const activeSession = session ?? voiceSessionRef.current;
      if (voiceSessionRef.current === activeSession) voiceSessionRef.current = null;
      void activeSession?.endSession().catch(() => {});
    };
  }, [addConversationMessage, display, language, loaded, speakWithAvatar, t]);

  useEffect(() => {
    if (!loaded || !display) return;
    const activeDisplay = display;
    const videoElement = didVideoRef.current;
    let cancelled = false;
    let avatar: DidStreamingAvatar | null = null;

    async function uploadAndPersistDidAvatarSource(characterToUpload: DoodleCharacter, didKey: string) {
      const localImage = characterToUpload.generatedDataUrl || characterToUpload.originalDataUrl;
      if (!localImage) return '';
      setConnection((current) => ({ ...current, avatar: 'connecting', message: 'Uploading local character image to D-ID...' }));
      const uploadedSourceUrl = await uploadDidImage({ apiKey: didKey, imageDataUrl: localImage });
      await persistDidAvatarSource(characterToUpload, uploadedSourceUrl);
      return uploadedSourceUrl;
    }

    async function startDidAvatar() {
      const keys = await loadSecretKeys();
      setNeedsDidConfig(!keys.did);
      if (!keys.did || !videoElement) {
        setDidPreviewEnabled(false);
        flushPendingSpeechToBrowser();
        return;
      }

      let sourceUrl = getPublicDidAvatarSource(activeDisplay);
      if (!sourceUrl) sourceUrl = await uploadAndPersistDidAvatarSource(activeDisplay, keys.did);
      if (!sourceUrl) {
        flushPendingSpeechToBrowser();
        return;
      }

      if (cancelled) return;
      setDidPreviewEnabled(false);

      avatar = new DidStreamingAvatar({
        apiKey: keys.did,
        sourceUrl,
        videoElement,
        language: language === 'zh' ? 'zh' : 'en',
        onStatusChange: (status, message) => {
          if (cancelled) return;
          if (status === 'idle') setDidPreviewEnabled(false);
          if (status === 'connecting') setConnection((current) => ({ ...current, avatar: 'connecting', message: 'D-ID avatar is getting ready...' }));
          if (status === 'ready') setConnection((current) => ({ ...current, avatar: current.agent === 'speaking' ? 'speaking' : 'ready', message: current.agent === 'speaking' ? current.message : t('readyNextTurn') }));
          if (status === 'speaking') setConnection((current) => ({ ...current, avatar: 'speaking', message: `${activeDisplay.name} ${t('speaking')}` }));
          if (status === 'error') {
            setDidPreviewEnabled(false);
            setConnection((current) => ({ ...current, avatar: 'error', message: message || 'D-ID avatar stream failed.' }));
          }
        },
        onVideoStreamStart: () => {
          if (!cancelled) setDidPreviewEnabled(true);
        },
      });
      didAvatarRef.current = avatar;
      const queuedSpeech = pendingAvatarSpeechRef.current.splice(0);
      queuedSpeech.forEach((speech) => { void avatar?.speak(speech).catch(() => speakWithBrowserVoice(speech, language)); });
      try {
        await avatar.connect();
      } catch (error) {
        if (!cancelled && sourceUrl === getPublicDidAvatarSource(activeDisplay)) {
          const refreshedSourceUrl = await uploadAndPersistDidAvatarSource(activeDisplay, keys.did);
          if (refreshedSourceUrl && !cancelled) {
            avatar = new DidStreamingAvatar({
              apiKey: keys.did,
              sourceUrl: refreshedSourceUrl,
              videoElement,
              language: language === 'zh' ? 'zh' : 'en',
              onStatusChange: (status, message) => {
                if (cancelled) return;
                if (status === 'idle') setDidPreviewEnabled(false);
                if (status === 'connecting') setConnection((current) => ({ ...current, avatar: 'connecting', message: 'D-ID avatar is getting ready...' }));
                if (status === 'ready') setConnection((current) => ({ ...current, avatar: current.agent === 'speaking' ? 'speaking' : 'ready', message: current.agent === 'speaking' ? current.message : t('readyNextTurn') }));
                if (status === 'speaking') setConnection((current) => ({ ...current, avatar: 'speaking', message: `${activeDisplay.name} ${t('speaking')}` }));
                if (status === 'error') {
                  setDidPreviewEnabled(false);
                  setConnection((current) => ({ ...current, avatar: 'error', message: message || 'D-ID avatar stream failed.' }));
                }
              },
              onVideoStreamStart: () => {
                if (!cancelled) setDidPreviewEnabled(true);
              },
            });
            didAvatarRef.current = avatar;
            await avatar.connect();
            return;
          }
        }
        if (!cancelled) {
          flushPendingSpeechToBrowser();
          setConnection((current) => ({ ...current, avatar: 'error', message: error instanceof Error ? error.message : 'D-ID avatar stream failed.' }));
        }
      }
    }

    void startDidAvatar();
    return () => {
      cancelled = true;
      if (didAvatarRef.current === avatar) didAvatarRef.current = null;
      void avatar?.destroy().catch(() => {});
    };
  }, [display, flushPendingSpeechToBrowser, language, loaded, t]);

  const setupIssue = needsElevenLabsConfig ? 'ElevenLabs API key or agent is missing. Open Settings, save the key, then recreate this character if needed.' : needsCustomChatConfig ? t('customLlmConfigMissing') : needsDidConfig ? t('didKeyMissing') : '';

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
          <div className={`character-portrait ${didPreviewEnabled ? 'has-live-avatar' : ''} ${connection.avatar === 'speaking' ? 'is-speaking' : ''}`}>
            {canUseDidAvatar ? <video ref={didVideoRef} className="did-portrait-video" aria-label={`${display.name} D-ID avatar`} autoPlay playsInline /> : null}
            {display.generatedDataUrl ? <img className="portrait-image" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="xl" />}
            <span className="avatar-expression-badge" aria-hidden="true">{connection.avatar === 'speaking' ? '✨' : connection.avatar === 'thinking' ? '💭' : '😊'}</span>
          </div>
          <div className={`ready-box ${voiceModeClass}`}><span className="dot" /><span><b>{display.name} {voiceModeTitle}</b><small>{voiceModeDetail}</small></span></div>
        </aside>
        <div className="text-chat">
          <header className="chat-main-header">
            <div className="chat-title-block">
              {display.generatedDataUrl ? <img className="stored-avatar small" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="sm" />}
              <span><b>{display.name}</b><span className="tag-row"><span className="tag">{displayStyleName}</span><span className="tag green">{displayPersonaName}</span></span></span>
            </div>
            <div className="chat-header-actions">
              <span className={`voice-status-pill ${voiceModeClass}`} aria-live="polite">
                {isVoiceLive ? <Mic size={18} /> : isVoiceConnecting ? <Volume2 size={18} /> : <MicOff size={18} />}
                {voiceModeTitle}
              </span>
              <button className="chat-menu-button" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            </div>
          </header>
          {setupIssue ? <div className="inline-warning">{setupIssue} <Link className="back-link" href="/settings">{t('openSettings')}</Link></div> : null}
          <div className="chat-thread"><MessageList messages={messages} character={display} /></div>
          <div className="input-area">
            <div className="input-row"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage(); }} placeholder={t('typeMessage')} /><button className="send-button" onClick={() => void sendMessage()}><Send /></button></div>
          </div>
        </div>
      </section>
    </div>
  );
}


function getRandomWelcomeMessage(characterName: string, language: string) {
  const welcomeMessages = getWelcomeMessages(characterName, language);
  return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)] ?? welcomeMessages[0];
}

function getWelcomeMessages(characterName: string, language: string) {
  return language === 'zh' ? [
    `你好呀，我是${characterName}！我已经准备好和你聊天啦。`,
    `${characterName}醒来啦！想聊聊画画、冒险，还是有趣的小故事？`,
    `欢迎回来！我是${characterName}，我可以听你说话，也可以陪你聊天。`,
    `太好了，你来啦！我是${characterName}，我们一起开始一个好玩的故事吧。`,
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

function speakWithBrowserVoice(text: string, language: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
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

function getPublicDidAvatarSource(character: DoodleCharacter) {
  const sourceUrl = character.avatarSourceUrl || character.generatedImageUrl || '';
  return /^https:\/\//i.test(sourceUrl) ? sourceUrl : '';
}

async function persistDidAvatarSource(character: DoodleCharacter, sourceUrl: string) {
  if (!/^https:\/\//i.test(sourceUrl)) return;
  const nextCharacter: DoodleCharacter = {
    ...character,
    avatarSourceUrl: sourceUrl,
    generatedImageUrl: character.generatedImageUrl && /^https:\/\//i.test(character.generatedImageUrl) ? character.generatedImageUrl : sourceUrl,
    updatedAt: new Date().toISOString(),
  };
  await saveCharacter(nextCharacter);
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
    pixar: ['#2d9cff', '#36d381', '#edf7ff'],
    disney: ['#ff7aa8', '#ffb060', '#fff2f6'],
    anime: ['#8b5cff', '#43d8ff', '#f3efff'],
    comic: ['#ff4d5a', '#ffd23f', '#fff4df'],
    watercolor: ['#73a7ff', '#ff9ed8', '#f1f7ff'],
    pixel: ['#7ed957', '#1f2933', '#efffe8'],
    cyber: ['#00e5ff', '#ff4fd8', '#effbff'],
    fantasy: ['#9b6dff', '#ffca5f', '#f6efff'],
    chibi: ['#ff77c8', '#8b5cff', '#fff0fa'],
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



