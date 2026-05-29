'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wand2, Plus, Settings } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/create', label: 'Create', icon: Wand2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Doodle Alive home">
        <span className="brand-mark">✣</span>
        <span className="brand-word">Doodle <b>Alive</b></span>
      </Link>
      <nav className="nav-pills" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? 'nav-pill active' : 'nav-pill'}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="top-actions">
        <Link className="primary-button small" href="/create">
          <Plus size={18} /> New Character
        </Link>
        <button className="lang-pill" type="button">
          EN / 中文
        </button>
      </div>
    </header>
  );
}
