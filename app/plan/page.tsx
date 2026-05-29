import { planSections } from '@/lib/data';

export default function PlanPage() {
  return (
    <div className="page-shell plan-doc card">
      <h1 className="create-title">Doodle Alive 功能开发计划</h1>
      <p className="subtitle">根据 PRD 拆分为视觉原型、AI 生成、D-ID、ElevenLabs、设置存储、安全发布等阶段。</p>
      <div className="plan-grid">
        {planSections.map((section) => (
          <section key={section.title} className="plan-card card">
            <h3>{section.title}</h3>
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
