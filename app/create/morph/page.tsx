import { MorphingExperience } from '@/components/MorphingExperience';
import { WizardHeader } from '@/components/WizardHeader';

export default function MorphPage() {
  return (
    <div className="page-shell morph-page">
      <WizardHeader activeStep={3} />
      <MorphingExperience />
    </div>
  );
}
