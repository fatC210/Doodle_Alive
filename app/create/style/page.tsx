import { StylePicker } from '@/components/StylePicker';
import { WizardHeader } from '@/components/WizardHeader';

export default function StylePage() {
  return (
    <div className="page-shell">
      <WizardHeader activeStep={2} />
      <StylePicker />
    </div>
  );
}
