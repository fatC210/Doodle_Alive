import { PersonaSelector } from '@/components/PersonaSelector';
import { WizardHeader } from '@/components/WizardHeader';

export default function PersonaPage() {
  return (
    <div className="page-shell">
      <WizardHeader activeStep={4} />
      <PersonaSelector />
    </div>
  );
}
