import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { LanguageProvider } from '@/lib/i18n';

const roundedFont = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-rounded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Doodle Alive',
  description: 'Turn children doodles into talking AI characters.',
  icons: {
    icon: [{ url: '/wechat-doodle-favicon-original-20260530.png', type: 'image/png', sizes: '64x64' }],
    shortcut: [{ url: '/wechat-doodle-favicon-original-20260530.png', type: 'image/png', sizes: '64x64' }],
    apple: [{ url: '/images/wechat-doodle-logo-original-20260530.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={roundedFont.variable}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const stored = localStorage.getItem('doodle-theme'); const query = new URLSearchParams(location.search).get('theme'); const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = query || stored || preferred; } catch (_) { document.documentElement.dataset.theme = 'light'; } })();`,
          }}
        />
        <LanguageProvider>
          <Header />
          <main>{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
