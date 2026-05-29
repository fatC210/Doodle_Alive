import Link from 'next/link';
import { Image as ImageIcon, Mic, Send, Volume2, X } from 'lucide-react';
import { CharacterAvatar, Waveform } from '@/components/Illustrations';

export default async function ChatPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const isLumi = characterId === 'lumi';
  return isLumi ? <TextChat /> : <VoiceChat />;
}

function VoiceChat() {
  return (
    <div className="page-shell">
      <div className="chat-topline"><Link className="back-link" href="/">← Back to Characters</Link><b>/chat</b><button className="ghost-button">☎ End Chat</button></div>
      <section className="chat-layout">
        <div className="video-card card">
          <span className="live-badge">● LIVE</span>
          <CharacterAvatar tone="dino" size="xl" />
          <span className="video-control"><Volume2 /></span>
        </div>
        <div className="chat-card">
          <div className="message"><CharacterAvatar tone="dino" size="sm" /><div className="bubble"><b>Rex</b><br />Hey there! 🦖<br />I&apos;m Rex! What adventure should we go on today?<span className="time">10:24 AM 🔊</span></div></div>
          <div className="message you"><div className="bubble"><b>You</b><br />Can we go to space and see the planets?<span className="time">10:24 AM ✓</span></div></div>
          <div className="message"><CharacterAvatar tone="dino" size="sm" /><div className="bubble"><b>Rex</b><br />Absolutely! 🚀<br />Let&apos;s zoom past the stars and say hi to Saturn! 🪐✨<span className="time">10:24 AM 🔊</span></div></div>
          <div className="quick-replies"><button>That sounds fun! 😊</button><button>Tell me more! ✨</button><button>What next?</button></div>
        </div>
        <aside className="profile-card card">
          <CharacterAvatar tone="dino" size="lg" />
          <h2>Rex</h2>
          <div className="tag-row"><span className="tag orange">Crayon</span><span className="tag green">Brave Buddy</span></div>
          <h4>About Rex</h4><p className="subtitle">Curious, brave, and loves exploring new places with friends.</p>
          <h4>Style</h4><span className="voice-chip">🖍 Crayon</span>
          <h4>Best For</h4><p className="subtitle">Imaginative play, learning, and adventure</p>
          <div className="settings-card" style={{ padding: 18 }}><b>Safety First</b><p className="subtitle">We keep chats fun, kind, and age-appropriate.</p><a className="back-link">Learn more</a></div>
        </aside>
        <div className="voice-console card">
          <div className="status-strip">
            <div className="status-item"><span className="dot" /><span>Live<small>Excellent</small></span></div>
            <div className="status-item"><span className="dot" /><span>STT<small>Listening</small></span></div>
            <div className="status-item"><span className="dot" /><span>Agent<small>Thinking</small></span></div>
            <div className="status-item"><span className="dot" /><span>Avatar<small>Live</small></span></div>
            <Waveform />
          </div>
          <button className="outline-button">⌨ Text instead</button>
          <div><button className="mic-button"><Mic size={62} /></button><div className="mic-copy">Listening...<br /><small>Tap to talk</small></div></div>
          <div className="tip-box"><b>✨ Tip</b><p className="subtitle">Speak clearly for the best experience!</p></div>
        </div>
      </section>
    </div>
  );
}

function TextChat() {
  return (
    <div className="page-shell">
      <div className="chat-topline"><Link className="ghost-button" href="/">← Back to Characters</Link><div className="tag-row"><CharacterAvatar tone="mint" size="sm" /><span><b>Lumi</b><br /><span className="tag">Watercolor</span> <span className="tag green">Curious Explorer</span></span></div><button className="ghost-button"><ImageIcon size={18} /> Gallery</button></div>
      <section className="text-chat-layout">
        <aside className="character-side card">
          <div className="character-portrait"><CharacterAvatar tone="mint" size="xl" /></div>
          <button className="outline-button">⛶</button>
          <div className="ready-box"><span className="dot" /> Lumi is ready to chat!<br /><small>Text mode is active</small></div>
        </aside>
        <div className="text-chat card">
          <div className="text-alert"><span>🎙️ Microphone access unavailable<small>We can&apos;t access your microphone right now. You can continue chatting with text.</small></span><span className="voice-chip">TEXT MODE ACTIVE</span></div>
          <div className="message"><CharacterAvatar tone="mint" size="sm" /><div className="bubble"><b>Lumi</b> <span className="time">10:24 AM</span>Hi there! I&apos;m Lumi! ✨<br />What would you like to explore today?</div></div>
          <div className="message you"><div className="bubble">Can you show me a drawing of a magical forest?<span className="time">You · 10:25 AM</span></div></div>
          <div className="message"><CharacterAvatar tone="mint" size="sm" /><div className="bubble"><b>Lumi</b> <span className="time">10:25 AM</span>Of course! 🌲✨ A magical forest is full of sparkles, hidden paths, and friendly creatures!<div className="chat-image" /></div></div>
          <div className="message you"><div className="bubble">That&apos;s beautiful! What lives there?<span className="time">You · 10:26 AM</span></div></div>
          <div className="message"><CharacterAvatar tone="mint" size="sm" /><div className="bubble"><b>Lumi</b> <span className="time">10:26 AM</span>Lots of creatures! 🦋 Deer, fireflies, wise owls, and even tiny forest guardians like me! 🌞</div></div>
          <div className="input-area">
            <div className="mode-note"><span>💬 You&apos;re chatting in text mode<br /><small>Microphone access is off. You can continue chatting with text anytime.</small></span><X size={18} /></div>
            <div className="input-row"><input placeholder="Type your message..." /><button className="send-button"><Send /></button></div>
            <button className="outline-button" style={{ marginTop: 12 }}><Mic size={18} /> Enable Microphone</button>
          </div>
        </div>
      </section>
    </div>
  );
}
