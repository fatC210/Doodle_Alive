'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Settings } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { getMorphingConfigIssues, type ConfigIssue } from '@/lib/config-requirements';
import { useLanguage } from '@/lib/i18n';
import { loadCustomImageKey } from '@/lib/secrets';
import { loadSettings } from '@/lib/storage';

const guardedPaths = new Set(['/create', '/create/style', '/create/morph']);

type GateState =
  | { path: string; status: 'ready' }
  | { path: string; status: 'blocked'; issue: ConfigIssue };
type GateViewState = GateState | { path: string; status: 'checking' };

export function CreateConfigGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const shouldGuard = guardedPaths.has(pathname);
  const [state, setState] = useState<GateViewState>({ path: shouldGuard ? '' : pathname, status: 'ready' });

  useEffect(() => {
    if (!shouldGuard) return;

    let cancelled = false;
    async function checkConfig() {
      try {
        const settings = loadSettings();
        const imageKey = await loadCustomImageKey();
        const issues = getMorphingConfigIssues(settings, imageKey);
        if (cancelled) return;
        setState(issues.length ? { path: pathname, status: 'blocked', issue: issues[0] } : { path: pathname, status: 'ready' });
      } catch {
        if (!cancelled) setState({ path: pathname, status: 'blocked', issue: 'customImageKey' });
      }
    }

    checkConfig();
    return () => {
      cancelled = true;
    };
  }, [shouldGuard, pathname]);

  const currentState: GateViewState = shouldGuard && state.path !== pathname ? { path: pathname, status: 'checking' } : state;

  if (!shouldGuard || currentState.status === 'ready' || currentState.status === 'checking') return <>{children}</>;

  return (
    <div className="page-shell">
      <section className="create-config-gate card" aria-live="polite">
        <span className="gate-icon"><AlertTriangle size={34} /></span>
        <div>
          <h1>{t('morphingNeedsAttention')}</h1>
          <p className="subtitle">{createConfigMessage(currentState.issue, t)}</p>
        </div>
        <div className="gate-actions">
          <Link className="primary-button" href="/settings/advanced"><Settings size={18} /> {t('openSettings')}</Link>
          <Link className="ghost-button" href="/">{t('navHome')}</Link>
        </div>
      </section>
    </div>
  );
}

function createConfigMessage(issue: ConfigIssue, t: ReturnType<typeof useLanguage>['t']) {
  return t('imageConfigMissing');
}
