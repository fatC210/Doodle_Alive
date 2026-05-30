import { DrawingCanvas } from '@/components/DrawingCanvas';
import { WizardHeader } from '@/components/WizardHeader';

export default function CreatePage() {
  return (
    <div className="page-shell">
      <WizardHeader activeStep={1} />
      <DrawingCanvas />
    </div>
  );
}
