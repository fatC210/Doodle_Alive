'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Moon, Plus, Settings, SunMedium, Wand2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function Header() {
  const pathname = usePathname();
  const { language, t, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navItems = [
    { href: '/', label: t('navHome'), icon: Home },
    { href: '/create', label: t('navCreate'), icon: Wand2 },
    { href: '/settings', label: t('navSettings'), icon: Settings },
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
          <Plus size={18} /> {t('newCharacter')}
        </Link>
        <button className="theme-pill" type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('switchToLight') : t('switchToDark')}>
          {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? t('lightTheme') : t('darkTheme')}</span>
        </button>
        <button className="lang-pill" type="button" onClick={toggleLanguage} aria-label={language === 'en' ? t('switchToChinese') : t('switchToEnglish')}>
          <span className={language === 'en' ? 'active-lang' : ''}>EN</span>
          <span aria-hidden="true">/</span>
          <span className={language === 'zh' ? 'active-lang' : ''}>中文</span>
        </button>
      </div>
    </header>
  );
}
