import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Doodle Alive',
  description: 'Turn children doodles into talking AI characters.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const stored = localStorage.getItem('doodle-theme'); const query = new URLSearchParams(location.search).get('theme'); const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = query || stored || preferred; } catch (_) { document.documentElement.dataset.theme = 'light'; } })();`,
          }}
        />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
