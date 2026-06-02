'use client';

import { planSections } from '@/lib/data';
import { useLanguage } from '@/lib/i18n';

export default function PlanPage() {
  const { language, t } = useLanguage();

  return (
    <div className="page-shell plan-doc card">
      <h1 className="create-title">{t('planTitle')}</h1>
      <p className="subtitle">{t('planCopy')}</p>
      <div className="plan-grid">
        {planSections.map((section) => (
          <section key={section.title} className="plan-card card">
            <h3>{language === 'zh' ? section.titleZh : section.title}</h3>
            <ul>{(language === 'zh' ? section.itemsZh : section.items).map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
