'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Send, Volume2, X } from 'lucide-react';
import { generateCharacterReply } from '@/lib/conversation';
import { useLanguage } from '@/lib/i18n';
import { loadCustomLlmKey, loadSecretKeys, missingRequiredKeys } from '@/lib/secrets';
import { getCharacter, getMessages, loadSettings, saveMessage } from '@/lib/storage';
import type { ChatMessage, DoodleCharacter, RealtimeConnectionState } from '@/lib/types';
import { CharacterAvatar, Waveform } from './Illustrations';

export function ChatExperience({ characterId }: { characterId: string }) {
  const { t } = useLanguage();
  const tRef = useRef(t);
  const [character, setCharacter] = useState<DoodleCharacter | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [textMode, setTextMode] = useState(false);
  const [textInputOpen, setTextInputOpen] = useState(false);
  const [connection, setConnection] = useState<RealtimeConnectionState>({
    live: 'idle',
    stt: 'idle',
    agent: 'idle',
    avatar: 'idle',
    message: t('readyWhen'),
    reconnectAttempts: 0,
  });
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  function stopMedia() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  useEffect(() => {
    async function load() {
      setLoaded(false);
      setCharacter(null);
      const stored = await getCharacter(characterId);
      if (stored) setCharacter(stored);
      const history = await getMessages(characterId);
      setMessages(history);
      setLoaded(true);
    }
    load();
  }, [characterId]);

  useEffect(() => {
    async function prepare() {
      const tx = tRef.current;
      const keys = await loadSecretKeys();
      const missing = missingRequiredKeys(keys);
      if (missing.elevenLabs || missing.did) {
        setTextMode(true);
        setConnection({
          live: 'text',
          stt: 'text',
          agent: missing.elevenLabs ? 'text' : 'ready',
          avatar: missing.did ? 'text' : 'ready',
          message: tx('missingVoiceVideo'),
          reconnectAttempts: 0,
          textModeReason: tx('missingVoiceVideoReason'),
        });
        return;
      }
      setConnection({
        live: 'ready',
        stt: 'ready',
        agent: 'ready',
        avatar: 'ready',
        message: tx('voiceReady'),
        reconnectAttempts: 0,
      });
    }
    prepare();

    return () => {
      stopMedia();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const display = useMemo(() => character, [character]);

  async function sendMessage(value = text) {
    if (!display) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: `msg-${Date.now()}`, characterId, role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    setConnection((current) => ({ ...current, agent: 'thinking', avatar: 'thinking', message: `${display.name} ${t('thinking')}` }));
    setMessages((items) => [...items, userMessage]);
    setText('');
    await saveMessage(userMessage);
    try {
      const settings = { ...loadSettings(), customLlmKey: await loadCustomLlmKey() };
      const replyContent = await generateCharacterReply(trimmed, display, settings);
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

  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setConnection((current) => ({ ...current, live: 'listening', stt: 'listening', agent: 'ready', avatar: 'ready', message: t('listening') }));
    } catch {
      setTextMode(true);
      setConnection((current) => ({ ...current, live: 'text', stt: 'error', message: t('micDenied'), textModeReason: t('micDeniedReason') }));
    }
  }

  function endChat() {
    stopMedia();
    setConnection((current) => ({ ...current, live: 'idle', stt: 'idle', agent: 'idle', avatar: 'idle', message: t('chatEnded'), reconnectAttempts: 0 }));
  }

  function reconnect() {
    setConnection((current) => {
      if (current.reconnectAttempts >= 3) {
        return { ...current, live: 'error', agent: 'error', avatar: 'error', message: t('sleepMessage') };
      }
      const attempts = current.reconnectAttempts + 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        setConnection((next) => ({ ...next, live: 'ready', agent: 'ready', avatar: 'ready', message: t('reconnectedReady') }));
      }, 700);
      return { ...current, live: 'reconnecting', agent: 'reconnecting', avatar: 'reconnecting', reconnectAttempts: attempts, message: `${t('reconnecting')} ${attempts}/3...` };
    });
  }

  if (!loaded) {
    return (
      <div className="page-shell">
        <div className="chat-topline"><Link className="ghost-button" href="/">← {t('backToCharacters')}</Link></div>
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
        <div className="chat-topline"><Link className="ghost-button" href="/">← {t('backToCharacters')}</Link></div>
        <section className="ready-card card error-card">
          <span className="check-big">!</span>
          <span><h2>{t('characterNotFound')}</h2><p className="subtitle">{t('characterNotFoundCopy')}</p></span>
          <Link className="primary-button" href="/create">{t('newCharacter')}</Link>
        </section>
      </div>
    );
  }

  if (textMode) {
    return (
      <div className="page-shell">
        <div className="chat-topline"><Link className="ghost-button" href="/">← {t('backToCharacters')}</Link><div className="tag-row">{display.generatedDataUrl ? <img className="stored-avatar small" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="sm" />}<span><b>{display.name}</b><br /><span className="tag">{display.styleName}</span> <span className="tag green">{display.personaName}</span></span></div><button className="ghost-button"><ImageIcon size={18} /> {t('gallery')}</button></div>
        <section className="text-chat-layout">
          <aside className="character-side card">
            <div className="character-portrait">{display.generatedDataUrl ? <img className="portrait-image" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'mint'} size="xl" />}</div>
            <button className="outline-button">⛶</button>
            <div className="ready-box"><span className="dot" /> {display.name} {t('readyToChat')}<br /><small>{connection.textModeReason || t('textModeActive')}</small></div>
          </aside>
          <div className="text-chat card">
            <div className="text-alert"><span>🎙️ {t('micUnavailable')}<small>{t('micUnavailableCopy')}</small></span><span className="voice-chip">{t('textModeActiveCaps')}</span></div>
            <MessageList messages={messages} character={display} />
            <div className="input-area">
              <div className="mode-note"><span>💬 {t('textChatting')}<br /><small>{t('micOffCopy')}</small></span><X size={18} /></div>
              <div className="input-row"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage(); }} placeholder={t('typeMessage')} /><button className="send-button" onClick={() => void sendMessage()}><Send /></button></div>
              <button className="outline-button" style={{ marginTop: 12 }} onClick={() => setTextMode(false)}><Mic size={18} /> {t('enableMicrophone')}</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="chat-topline"><Link className="back-link" href="/">← {t('backToCharacters')}</Link><b>/chat</b><button className="ghost-button" onClick={endChat}>☎ {t('endChat')}</button></div>
      <section className="chat-layout">
        <div className="video-card card">
          <span className="live-badge">● {t('live')}</span>
          {display.generatedDataUrl ? <img className="portrait-image hero-character" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'dino'} size="xl" />}
          <span className="video-control"><Volume2 /></span>
        </div>
        <div className="chat-card">
          <MessageList messages={messages} character={display} />
          <div className="quick-replies"><button>{t('quickFun')} 😊</button><button>{t('quickMore')} ✨</button><button>{t('quickNext')}</button></div>
        </div>
        <aside className="profile-card card">
          {display.generatedDataUrl ? <img className="stored-avatar large" src={display.generatedDataUrl} alt={display.name} /> : <CharacterAvatar tone={display.tone || 'dino'} size="lg" />}
          <h2>{display.name}</h2>
          <div className="tag-row"><span className="tag orange">{display.styleName}</span><span className="tag green">{display.personaName}</span></div>
          <h4>{t('about')} {display.name}</h4><p className="subtitle">{t('curiousProfile')}</p>
          <h4>{t('style')}</h4><span className="voice-chip">✨ {display.styleName}</span>
          <h4>{t('bestFor')}</h4><p className="subtitle">{t('bestForCopy')}</p>
          <div className="settings-card" style={{ padding: 18 }}><b>{t('safetyFirst')}</b><p className="subtitle">{t('safetyFirstCopy')}</p><a className="back-link">{t('learnMore')}</a></div>
        </aside>
        <div className="voice-console card">
          <div className="status-strip">
            <div className="status-item"><span className={`dot ${connection.live === 'error' ? 'danger-dot' : ''}`} /><span>Live<small>{connection.live}</small></span></div>
            <div className="status-item"><span className={`dot ${connection.stt === 'error' ? 'danger-dot' : ''}`} /><span>STT<small>{connection.stt}</small></span></div>
            <div className="status-item"><span className={`dot ${connection.agent === 'error' ? 'danger-dot' : ''}`} /><span>Agent<small>{connection.agent}</small></span></div>
            <div className="status-item"><span className={`dot ${connection.avatar === 'error' ? 'danger-dot' : ''}`} /><span>Avatar<small>{connection.avatar}</small></span></div>
            <Waveform />
          </div>
          <button className="outline-button" onClick={() => setTextInputOpen((open) => !open)}>⌨ {textInputOpen ? t('hideText') : t('textInstead')}</button>
          <div><button className="mic-button" onClick={() => void startListening()}><Mic size={62} /></button><div className="mic-copy">{connection.message}<br /><small>{t('tapToTalk')}</small></div></div>
          <div className="tip-box"><b>✨ {t('tip')}</b><p className="subtitle">{t('speakClearly')}</p><button className="ghost-button" onClick={reconnect}>{t('wakeUp')}</button></div>
          {textInputOpen ? <div className="voice-text-entry"><div className="input-row"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage(); }} placeholder={t('fallbackMessage')} /><button className="send-button" onClick={() => void sendMessage()}><Send /></button></div></div> : null}
        </div>
      </section>
    </div>
  );
}

function MessageList({ messages, character }: { messages: ChatMessage[]; character: DoodleCharacter }) {
  const { t } = useLanguage();
  return (
    <>
      {messages.map((message) => (
        <div key={message.id} className={`message ${message.role === 'user' ? 'you' : ''}`}>
          {message.role === 'character' ? (character.generatedDataUrl ? <img className="stored-avatar small" src={character.generatedDataUrl} alt={character.name} /> : <CharacterAvatar tone={character.tone || 'mint'} size="sm" />) : null}
          <div className="bubble"><b>{message.role === 'user' ? t('you') : message.role === 'system' ? t('system') : character.name}</b><br />{message.content}<span className="time">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {message.role === 'user' ? '✓' : message.role === 'character' ? '🔊' : ''}</span>{message.imageUrl ? <img className="chat-image" src={message.imageUrl} alt="" /> : null}</div>
        </div>
      ))}
    </>
  );
}
