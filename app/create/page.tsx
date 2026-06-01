import { DrawingCanvas } from '@/components/DrawingCanvas';
import { WizardHeader } from '@/components/WizardHeader';

type CreatePageProps = {
  searchParams: Promise<{ draw?: string | string[] | undefined; new?: string | string[] | undefined }>;
};

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams;
  const drawParam = Array.isArray(params.draw) ? params.draw[0] : params.draw;
  const newParam = Array.isArray(params.new) ? params.new[0] : params.new;
  const freshStart = newParam === '1';
  const forceDrawStep = drawParam === '1';

  return (
    <div className="page-shell">
      <WizardHeader activeStep={1} />
      <DrawingCanvas freshStart={freshStart} forceDrawStep={forceDrawStep} resumeDraft={!freshStart && !forceDrawStep} />
    </div>
  );
}
