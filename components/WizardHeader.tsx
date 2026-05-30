'use client';

import { useLanguage } from '@/lib/i18n';

export function WizardHeader({ activeStep }: { activeStep: 1 | 2 | 3 | 4 }) {
  const { t } = useLanguage();
  const steps = [t('stepDraw'), t('stepStyle'), t('stepMagic'), t('stepPersona')];

  return (
    <div className="wizard-head">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < activeStep;
        const active = step === activeStep;
        return (
          <span className="wizard-step-fragment" key={label}>
            <span className={`step-dot ${done ? 'done' : active ? 'active' : ''}`}>{done ? '✓' : step}</span>
            <b>{label}</b>
            {step < steps.length ? <span className="step-line" /> : null}
          </span>
        );
      })}
    </div>
  );
}
