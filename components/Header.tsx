'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Plus, Settings, Wand2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function Header() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const navItems = [
    { href: '/', activePath: '/', label: t('navHome'), icon: Home },
    { href: '/create?new=1', activePath: '/create', label: t('navCreate'), icon: Wand2 },
    { href: '/settings', activePath: '/settings', label: t('navSettings'), icon: Settings },
  ];

  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label={t('homeAria')}>
        <span className="brand-mark" aria-hidden="true">
          <Image
            src="/images/wechat-doodle-logo-original-20260530.png"
            alt=""
            width={48}
            height={48}
            priority
            unoptimized
          />
        </span>
        <span className="brand-word">Doodle <b>Alive</b></span>
      </Link>
      <nav className="nav-pills" aria-label={t('primaryNavigation')}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.activePath === '/' ? pathname === '/' : pathname.startsWith(item.activePath);
          return (
            <Link key={item.href} href={item.href} className={active ? 'nav-pill active' : 'nav-pill'}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="top-actions">
        <Link className="primary-button small" href="/create?new=1">
          <Plus size={18} /> {t('newCharacter')}
        </Link>
      </div>
    </header>
  );
}
