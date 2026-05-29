import Link from 'next/link';
import { MessageCircle, PlayCircle, Shield, Sparkles, Wand2, Cloud } from 'lucide-react';
import { CharacterAvatar, DoodleDrawing, MagicPortal } from '@/components/Illustrations';
import { characters } from '@/lib/data';

export default function HomePage() {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="hero-copy">
          <h1>Bring your<br />drawings to life <span className="spark-inline">✨</span></h1>
          <p>Turn your doodles into talking characters and start amazing conversations.</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/create"><Sparkles size={20} /> New Character</Link>
            <Link className="ghost-button" href="/create/morph"><PlayCircle size={20} /> How it works</Link>
          </div>
        </div>
        <div className="hero-art">
          <span className="sparkle one">✦</span>
          <span className="sparkle two">✧</span>
          <span className="sparkle three">✶</span>
          <div className="hero-card"><DoodleDrawing /></div>
          <span className="hero-pencil" />
          <MagicPortal />
        </div>
      </section>

      <section className="my-characters">
        <div className="section-row">
          <h2>My Characters <span className="count-badge">7</span></h2>
          <Link className="back-link" href="/create">View all →</Link>
        </div>
        <div className="character-grid">
          {characters.map((character, index) => (
            <article key={character.name} className={`character-card ${index === 0 ? 'featured' : ''}`}>
              {character.badge ? <span className="new-ribbon">✨ {character.badge}</span> : null}
              <CharacterAvatar tone={character.color} size="md" />
              <div className="character-meta">
                <h3>{character.name}</h3>
                <div className="tag-row">
                  <span className="tag">{character.style}</span>
                  <span className={`tag ${index % 3 === 0 ? 'green' : index % 3 === 1 ? 'orange' : 'blue'}`}>{character.persona}</span>
                </div>
                <div className="meta-date">{character.date}</div>
                <Link href={`/chat/${character.name.toLowerCase()}`} className="card-cta"><MessageCircle size={15} /> Continue Chat</Link>
              </div>
              <span className="card-menu">⋮</span>
            </article>
          ))}
          <Link href="/create" className="character-card new-card">
            <span className="wand"><Wand2 size={56} /></span>
            <b>Create a new character</b>
            <small>Draw something amazing and watch it come alive!</small>
            <span className="primary-button small">+ New Character</span>
          </Link>
        </div>
      </section>

      <section className="feature-strip card">
        <div className="feature-item"><span className="feature-icon"><Shield /></span><span><b>Safe & Kid-Friendly</b>Positive experience for kids.</span></div>
        <div className="feature-item"><span className="feature-icon"><Cloud /></span><span><b>Saved Locally</b>Your characters never leave your browser.</span></div>
        <div className="feature-item"><span className="feature-icon"><Sparkles /></span><span><b>Tip</b>Add lots of details for magical results!</span></div>
      </section>
    </div>
  );
}
